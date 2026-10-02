import { getAuth } from '@/lib/auth/server';

export const runtime = 'nodejs';

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return getAuth().handler().GET(request, ctx);
}
export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return getAuth().handler().POST(request, ctx);
}
export async function PUT(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return getAuth().handler().PUT(request, ctx);
}
export async function PATCH(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return getAuth().handler().PATCH(request, ctx);
}
export async function DELETE(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return getAuth().handler().DELETE(request, ctx);
}
