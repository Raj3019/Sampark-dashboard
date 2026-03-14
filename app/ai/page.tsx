'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import ChatChartCard from '@/components/charts/ChatChartCard';
import { ChartSpec } from '@/lib/ai/types';

const STARTER_PROMPTS = [
  'Summarize last 3 months Chirag Nagar data.',
  'Show monthly attendance trend chart for Chirag Nagar for 3 months.',
  'Give status breakdown for Chirag Nagar and Kishor for last 3 months.',
];

function isChartSpec(value: unknown): value is ChartSpec {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as ChartSpec;
  if (!['bar', 'line', 'pie'].includes(candidate.type)) return false;
  if (!Array.isArray(candidate.labels) || candidate.labels.length === 0) return false;
  if (!Array.isArray(candidate.series) || candidate.series.length === 0) return false;
  return candidate.series.every((s) => Array.isArray(s.data) && s.data.length === candidate.labels.length);
}

function extractText(message: UIMessage): string {
  const textParts = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part ? part.text : ''))
    .filter(Boolean);

  return textParts.join('\n').trim();
}

function extractCharts(message: UIMessage): ChartSpec[] {
  const charts: ChartSpec[] = [];

  for (const part of message.parts) {
    if (part.type === 'tool-create_chart' && part.state === 'output-available' && isChartSpec(part.output)) {
      charts.push(part.output);
    }
  }

  return charts;
}

export default function AIPage() {
  const [input, setInput] = useState('');
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const { messages, status, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const renderedMessages = useMemo(
    () => messages.map((message) => ({
      ...message,
      text: extractText(message),
      charts: extractCharts(message),
    })),
    [messages]
  );

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [renderedMessages, status]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    await sendMessage({ text: trimmed });
  };

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-900/60 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Akshar</h1>
            <p className="text-slate-400 text-sm mt-1">Your in-app Sabha data assistant for trends, summaries, and charts.</p>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-medium border border-orange-500/30 bg-orange-500/10 text-orange-300">
            Data-only mode
          </span>
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max pr-2">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setInput(prompt)}
              className="px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/80 text-slate-300 text-xs hover:bg-slate-700 hover:text-slate-100 transition-colors whitespace-nowrap"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="h-[64vh] overflow-y-auto p-4 sm:p-5 space-y-4">
          {renderedMessages.length === 0 && (
            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl px-4 py-3 bg-slate-800/90 border border-slate-700 text-slate-100">
                <p className="text-sm leading-relaxed">
                  Jai Swaminarayan. I am Akshar. I can help with Chirag Nagar and Kishor Sabha data, trends, summaries, and charts.
                </p>
              </div>
            </div>
          )}

          {renderedMessages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={isUser ? 'max-w-[78%]' : 'max-w-[92%]'}>
                  <p className={`text-[11px] mb-1 ${isUser ? 'text-right text-orange-300/80' : 'text-slate-500'}`}>
                    {isUser ? 'You' : 'Akshar'}
                  </p>
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      isUser
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/30'
                        : 'bg-slate-800/90 border border-slate-700 text-slate-100'
                    }`}
                  >
                    {message.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>}
                    {message.charts.map((chart, index) => (
                      <ChatChartCard key={`${message.id}-${index}`} chart={chart} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {status === 'submitted' && (
            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl px-4 py-3 bg-slate-800/90 border border-slate-700 text-slate-300 text-sm inline-flex items-center gap-2">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.1s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                </span>
                Akshar is preparing your answer
              </div>
            </div>
          )}

          <div ref={scrollAnchorRef} />
        </div>

        <div className="border-t border-slate-800 p-3 sm:p-4 bg-slate-900/60">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 mb-3">
              {error.message}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about Chirag Nagar last 3 months, trends, or charts..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-sm font-semibold disabled:opacity-60 disabled:hover:bg-orange-500 transition-colors"
            >
              {isLoading ? 'Working...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
