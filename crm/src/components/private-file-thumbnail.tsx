"use client";
import { useState } from 'react';
export function PrivateFileThumbnail({ id, name }: {
    id: string;
    name: string;
}) {
    const [failed, setFailed] = useState(false);
    return failed ? <span className="p-2 text-center text-xs">缩略图暂不可用<br />点击预览原件</span> : <img loading="lazy" decoding="async" src={`/api/files/${id}/thumbnail`} alt={`${name}原件缩略图`} onError={() => setFailed(true)} className="h-full w-full object-contain"/>;
}
