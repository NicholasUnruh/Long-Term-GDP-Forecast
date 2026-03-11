'use client';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export function BlockEquation({ math }: { math: string }) {
  return (
    <div className="my-4 overflow-x-auto">
      <BlockMath math={math} />
    </div>
  );
}

export function InlineEquation({ math }: { math: string }) {
  return <InlineMath math={math} />;
}
