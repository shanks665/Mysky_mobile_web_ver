import { useQuery } from '@tanstack/react-query';
import { postsApi } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

export default function FeedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => postsApi.getFeed(),
  });

  if (isLoading) {
    return <div className="text-center">読み込み中...</div>;
  }

  const posts = data?.data.data.content || [];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">フィード</h2>
        </CardHeader>
      </Card>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            投稿がありません
          </CardContent>
        </Card>
      ) : (
        posts.map((post: any) => (
          <Card key={post.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10" />
                <div>
                  <p className="font-semibold">{post.author?.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatRelativeTime(post.createdAt)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{post.content}</p>
              <div className="mt-4 flex gap-4">
                <Button variant="ghost" size="sm">
                  <Heart className="mr-2 h-4 w-4" />
                  {post.likesCount || 0}
                </Button>
                <Button variant="ghost" size="sm">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {post.commentsCount || 0}
                </Button>
                <Button variant="ghost" size="sm">
                  <Share2 className="mr-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
