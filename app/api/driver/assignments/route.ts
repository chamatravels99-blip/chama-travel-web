import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['accept', 'decline', 'start', 'complete']);

export async function GET() {
  try {
    const { supabase } = await requireRoles(['driver']);
    const [assignments, settlements] = await Promise.all([
      supabase.rpc('list_driver_assignments'),
      supabase.rpc('driver_list_own_settlements'),
    ]);
    if (assignments.error || settlements.error) {
      console.error('Driver dashboard data could not be loaded.', assignments.error?.code, settlements.error?.code);
      return NextResponse.json(
        { success: false, error: 'Your driver information is temporarily unavailable.' },
        { status: 503 }
      );
    }
    return NextResponse.json({
      success: true,
      data: assignments.data ?? [],
      settlements: settlements.data ?? [],
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { supabase } = await requireRoles(['driver']);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Enter valid assignment details.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Enter valid assignment details.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const assignmentId = typeof input.assignment_id === 'string' ? input.assignment_id : '';
    const action = typeof input.action === 'string' ? input.action : '';
    if (!UUID_PATTERN.test(assignmentId) || !ACTIONS.has(action)) {
      return NextResponse.json({ success: false, error: 'Assignment action is invalid.' }, { status: 400 });
    }
    const { error } = await supabase.rpc('update_driver_assignment', {
      p_assignment_id: assignmentId,
      p_action: action,
    });
    if (error) {
      console.error('Driver assignment update failed.', error.code);
      return NextResponse.json(
        { success: false, error: 'This action is no longer available for the assignment.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return authorizationResponse(error);
  }
}
