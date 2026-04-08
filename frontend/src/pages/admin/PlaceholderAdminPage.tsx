import { Construction } from 'lucide-react';

export default function PlaceholderAdminPage({ title }: { title: string }) {
  return (
    <div className="h-[80vh] flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
        <Construction className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-bold font-heading mb-4 text-foreground">{title}</h1>
      <p className="text-muted-foreground max-w-md">
        Phân hệ quản trị này đang được hoàn thiện. Vui lòng quay lại sau nhé!
      </p>
    </div>
  );
}
