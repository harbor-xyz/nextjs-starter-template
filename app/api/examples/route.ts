// app/api/examples/route.ts
import { NextResponse } from 'next/server';

// Dummy examples data stored directly in the route file
const examples = [
  { 
    id: '1', 
    title: 'First Example', 
    description: 'This is the first example item',
    status: 'active',
    createdAt: '2023-01-15T08:00:00Z'
  },
  { 
    id: '2', 
    title: 'Second Example', 
    description: 'This is the second example item',
    status: 'pending',
    createdAt: '2023-02-20T10:30:00Z'
  },
  { 
    id: '3', 
    title: 'Third Example', 
    description: 'This is the third example item',
    status: 'completed',
    createdAt: '2023-03-05T14:45:00Z'
  }
];

export async function GET() {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return NextResponse.json(examples);
}

export async function POST(request: Request) {
  try {
    const newExample = await request.json();
    
    // Validate required fields
    if (!newExample.title || !newExample.description) {
      return NextResponse.json(
        { error: 'Title and description are required fields' },
        { status: 400 }
      );
    }
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Generate a new example with an ID
    const example = { 
      id: `${Date.now()}`, 
      createdAt: new Date().toISOString(),
      status: 'pending',
      ...newExample 
    };
    
    return NextResponse.json({ success: true, example }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request data' },
      { status: 400 }
    );
  }
}