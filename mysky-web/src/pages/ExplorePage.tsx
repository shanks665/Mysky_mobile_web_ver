import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ExplorePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">探索</h1>
      <Card>
        <CardHeader>
          <CardTitle>近くのユーザーとイベントを探索</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            位置情報を使用して、近くのユーザーやイベントを見つけることができます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
