import { NextResponse } from 'next/server';
import { convertToModelMessages, stepCountIs, streamText, tool, UIMessage } from 'ai';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';
import { getSabhaData } from '@/lib/server/sabhaDataService';
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
  'When user asks for chart, call create_chart with validated labels and numeric series.',
].join(' ');

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured. Add it to your .env file.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const incomingMessages = (Array.isArray(body?.messages) ? body.messages : []) as UIMessage[];
    const modelMessages = await convertToModelMessages(
      incomingMessages.map((message) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _ignoredId, ...messageWithoutId } = message;
        return messageWithoutId;
      })
    );

    const { data } = await getSabhaData();
    const modelId = process.env.GROQ_MODEL || DEFAULT_MODEL;

    const result = streamText({
      model: groq(modelId),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      stopWhen: stepCountIs(10),
      tools: {
        get_chirag_summary: tool({
          description: 'Get Chirag Nagar summary for last N months with optional attending filter',
          inputSchema: z.object({
            months: z.number().int().min(1).max(12).optional(),
            attendingFilter: attendingFilterSchema.optional(),
          }),
          execute: async (input) => getChiragSummary(data, input),
        }),
        get_attendance_trend: tool({
          description: 'Get sabha attendance trend points and chart-ready series',
          inputSchema: z.object({
            sabhaType: sabhaTypeSchema,
            months: z.number().int().min(1).max(12).optional(),
            mode: trendModeSchema.optional(),
          }),
          execute: async (input) => getAttendanceTrend(data, input),
        }),
        get_status_breakdown: tool({
          description: 'Get active/at-risk/inactive counts for a sabha',
          inputSchema: z.object({
            sabhaType: sabhaTypeSchema,
            months: z.number().int().min(1).max(12).optional(),
          }),
          execute: async (input) => getStatusBreakdown(data, input),
        }),
        get_yuvaks_by_kk: tool({
          description: 'Get yuvak list under a specific follow-up KK name (supports partial match)',
          inputSchema: z.object({
            kkName: z.string().min(1).max(80),
            sabhaType: sabhaTypeSchema.optional(),
            attendingFilter: attendingFilterSchema.optional(),
            limit: z.number().int().min(1).max(200).optional(),
          }),
          execute: async (input) => getYuvaksByKK(data, input),
        }),
        get_yuvak_directory: tool({
          description: 'Get yuvak directory with flexible filters (sabha, attending yes/no/all, status, kkName, query).',
          inputSchema: z.object({
            sabhaType: sabhaTypeSchema.optional(),
            attendingFilter: attendingFilterSchema.optional(),
            statusFilter: statusFilterSchema.optional(),
            kkName: z.string().min(1).max(80).optional(),
            query: z.string().min(1).max(80).optional(),
            limit: z.number().int().min(1).max(200).optional(),
          }),
          execute: async (input) => getYuvakDirectory(data, input),
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


