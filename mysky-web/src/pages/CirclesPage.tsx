import { useQuery } from '@tanstack/react-query';
import { circlesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

export default function CirclesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['circles'],
    queryFn: () => circlesApi.getAll(),
  });

  if (isLoading) return <div>読み込み中...</div>;

  const circles = data?.data.data || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">サークル</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {circles.map((circle: any) => (
          <Card key={circle.id}>
            <CardHeader>
              <CardTitle>{circle.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{circle.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {circle.membersCount || 0}人
                </span>
                <Button size="sm">参加</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
