import { NextResponse } from 'next/server';
import { convertToModelMessages, stepCountIs, streamText, tool, UIMessage } from 'ai';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';
import { getSabhaData } from '@/lib/server/sabhaDataService';
import { getUserAccessContext, requireApiSession } from '@/lib/auth/session';
import {
  attendingFilterSchema,
  chartSpecSchema,
  getAttendanceTrend,
  getChiragSummary,
  getStatusBreakdown,
  getYuvakDirectory,
  getYuvaksByKK,
  sabhaTypeSchema,
  trendModeSchema,
  statusFilterSchema,
  validateChartSpec,
} from '@/lib/server/aiTools';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const TOOL_CAPABLE_MODELS = new Set(['llama-3.3-70b-versatile']);

const requiredNameSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.string().min(1).max(80)
);

const optionalTextFilterSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().min(1).max(80).optional()
);

function optionalEnumFrom<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    schema.optional()
  );
}

function optionalIntSchema(min: number, max: number) {
  return z.preprocess(
    (value) => {
      const normalize = (n: number) => {
        const rounded = Math.round(n);
        return Math.min(max, Math.max(min, rounded));
      };

      if (typeof value === 'number') {
        return Number.isFinite(value) ? normalize(value) : value;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length === 0) return undefined;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? normalize(parsed) : value;
      }

      return value;
    },
    z.number().int().optional()
  );
}


const SYSTEM_PROMPT = [
  'You are Akshar, the Sabha Analytics Assistant for this app only.',
  'Allowed scope: Chirag Nagar and Kishor Sabha attendance, yuvaks, KKs, follow-up, trends, and metrics derived from the app data.',
  'Treat both sabhas together as the full dataset when the user asks for whole-data answers.',
  'You have full access to the latest sheet data through the provided tools. Never say you do not have access for in-scope app data.',
  'If user asks anything outside this scope, refuse politely in one sentence and suggest one in-scope question.',
  'Never use external knowledge, web search, or assumptions beyond provided tool outputs.',
  'When data is needed, call tools. For list queries (names/KK/status/non-attending/sabha filters), call get_yuvak_directory first.',
  'For broad or complex filtering questions, use get_yuvak_directory with default all-data scope unless user asks for a specific sabha.',
  'Use get_yuvaks_by_kk only when the user explicitly asks by KK name.',
  'If user asks for latest or last-updated data, include lastUpdated from tool output in the response.',
  'Never print function tags, XML tags, or JSON function-call stubs in chat output (for example: <function=...>).',
  'Always use native tool calls via the tools API, then respond with plain-language results only.',
  'When user asks for chart, call create_chart with validated labels and numeric series.',
].join(' ');

function sameKkName(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
}

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured. Add it to your .env file.' },
      { status: 500 }
    );
  }

  try {
    const { session, response } = await requireApiSession();
    if (response) return response;

    const access = await getUserAccessContext(session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const incomingMessages = (Array.isArray(body?.messages) ? body.messages : []) as UIMessage[];
    const modelMessages = await convertToModelMessages(
      incomingMessages.map((message) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _ignoredId, ...messageWithoutId } = message;
        return messageWithoutId;
      })
    );

    const { data: rawData } = await getSabhaData();
    const data = access.role === 'kk'
      ? {
          ...rawData,
          yuvaks: access.assignedKK
            ? rawData.yuvaks.filter((y) => sameKkName(y.followUpKK, access.assignedKK))
            : [],
        }
      : rawData;
    const requestedModel = process.env.GROQ_MODEL || DEFAULT_MODEL;
    const modelId = TOOL_CAPABLE_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;

    const result = streamText({
      model: groq(modelId),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      stopWhen: stepCountIs(10),
      tools: {
        get_chirag_summary: tool({
          description: 'Get Chirag Nagar summary for last N months with optional attending filter',
          inputSchema: z.object({
            months: optionalIntSchema(1, 12),
            attendingFilter: optionalEnumFrom(attendingFilterSchema),
          }),
          execute: async (input) => getChiragSummary(data, input),
        }),
        get_attendance_trend: tool({
          description: 'Get sabha attendance trend points and chart-ready series',
          inputSchema: z.object({
            sabhaType: sabhaTypeSchema,
            months: optionalIntSchema(1, 12),
            mode: optionalEnumFrom(trendModeSchema),
          }),
          execute: async (input) => getAttendanceTrend(data, input),
        }),
        get_status_breakdown: tool({
          description: 'Get active/at-risk/inactive counts for a sabha',
          inputSchema: z.object({
            sabhaType: sabhaTypeSchema,
            months: optionalIntSchema(1, 12),
          }),
          execute: async (input) => getStatusBreakdown(data, input),
        }),
        get_yuvaks_by_kk: tool({
          description: 'Get yuvak list under a specific follow-up KK name (supports partial match)',
          inputSchema: z.object({
            kkName: requiredNameSchema,
            sabhaType: optionalEnumFrom(sabhaTypeSchema),
            attendingFilter: optionalEnumFrom(attendingFilterSchema),
            limit: optionalIntSchema(1, 200),
          }),
          execute: async (input) => getYuvaksByKK(data, input),
        }),
        get_yuvak_directory: tool({
          description: 'Get yuvak directory with flexible filters (sabha, attending yes/no/all, status, kkName, query).',
          // Keep schema permissive to avoid provider-side tool-call validation failures.
          inputSchema: z.object({
            sabhaType: z.any().optional(),
            attendingFilter: z.any().optional(),
            statusFilter: z.any().optional(),
            kkName: z.any().optional(),
            query: z.any().optional(),
            limit: z.any().optional(),
          }).passthrough(),
          execute: async (input) => {
            const normalizeText = (value: unknown): string | undefined => {
              if (typeof value !== 'string') return undefined;
              const t = value.trim();
              return t.length ? t : undefined;
            };

            const asSabha = (value: unknown): 'Chirag Nagar' | 'Chirag Nagar(Kishor)' | undefined =>
              value === 'Chirag Nagar' || value === 'Chirag Nagar(Kishor)' ? value : undefined;

            const asAttending = (value: unknown): 'yes' | 'no' | 'all' | undefined =>
              value === 'yes' || value === 'no' || value === 'all' ? value : undefined;

            const asStatus = (value: unknown): 'green' | 'yellow' | 'red' | 'all' | undefined =>
              value === 'green' || value === 'yellow' || value === 'red' || value === 'all' ? value : undefined;

            const clampLimit = (value: unknown): number | undefined => {
              const toNum = (v: unknown): number | undefined => {
                if (typeof v === 'number' && Number.isFinite(v)) return v;
                if (typeof v === 'string' && v.trim().length) {
                  const parsed = Number(v.trim());
                  if (Number.isFinite(parsed)) return parsed;
                }
                return undefined;
              };
              const n = toNum(value);
              if (n === undefined) return undefined;
              return Math.min(200, Math.max(1, Math.round(n)));
            };

            return getYuvakDirectory(data, {
              sabhaType: asSabha(input?.sabhaType),
              attendingFilter: asAttending(input?.attendingFilter),
              statusFilter: asStatus(input?.statusFilter),
              kkName: normalizeText(input?.kkName),
              query: normalizeText(input?.query),
              limit: clampLimit(input?.limit),
            });
          },
        }),
        create_chart: tool({
          description: 'Create validated chart payload for inline UI rendering',
          inputSchema: chartSpecSchema,
          execute: async (chart) => validateChartSpec(chart),
        }),
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process chat request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


