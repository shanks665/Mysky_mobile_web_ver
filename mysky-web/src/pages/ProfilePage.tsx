import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  
  const { data, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getUser(Number(userId)),
    enabled: !!userId,
  });

  if (isLoading) return <div>読み込み中...</div>;

  const user = data?.data.data;

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-primary/10" />
            <div>
              <CardTitle>{user?.displayName}</CardTitle>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4">{user?.bio || 'プロフィールが設定されていません'}</p>
          <div className="flex gap-4 mb-4">
            <span className="text-sm">
              <strong>{user?.followersCount || 0}</strong> フォロワー
            </span>
            <span className="text-sm">
              <strong>{user?.followingCount || 0}</strong> フォロー中
            </span>
          </div>
          <Button className="w-full">フォロー</Button>
        </CardContent>
      </Card>
    </div>
  );
}
