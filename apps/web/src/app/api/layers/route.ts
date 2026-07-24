// SOURCING: none — pure logic, no upstream component applies
import { NextResponse } from 'next/server';
import { NATIVE_LAYER_DESCRIPTORS } from '@commonplace/multiplex-layers';

export async function GET() {
  return NextResponse.json({ layers: NATIVE_LAYER_DESCRIPTORS });
}
