import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function EventsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.getUpcoming(),
  });

  if (isLoading) return <div>読み込み中...</div>;

  const events = data?.data.data || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">イベント</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {events.map((event: any) => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle>{event.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{event.description}</p>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">{formatDate(event.startTime)}</span>
              </div>
              <Button className="w-full">参加する</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
