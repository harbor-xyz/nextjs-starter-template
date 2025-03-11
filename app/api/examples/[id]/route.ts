// app/api/examples/[id]/route.ts
import { NextResponse } from 'next/server';

// Same dummy data as in the main route
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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const example = examples.find(item => item.id === params.id);
  
  if (!example) {
    return NextResponse.json(
      { error: 'Example not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json(example);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Check if example exists (in a real app we'd update in database)
    const exampleExists = examples.some(item => item.id === params.id);
    
    if (!exampleExists) {
      return NextResponse.json(
        { error: 'Example not found' },
        { status: 404 }
      );
    }
    
    // Return updated example (simulated)
    return NextResponse.json({
      success: true,
      example: {
        id: params.id,
        ...updates,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request data' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Check if example exists (in a real app we'd delete from database)
  const exampleExists = examples.some(item => item.id === params.id);
  
  if (!exampleExists) {
    return NextResponse.json(
      { error: 'Example not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({
    success: true,
    message: 'Example deleted successfully'
  });
}