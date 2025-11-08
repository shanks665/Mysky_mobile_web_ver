import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { BoardPost, PostCreationData } from '../models/BoardPost';

// サークル掲示板の投稿を取得
export const getCircleBoardPosts = async (circleId: string, lastVisible?: any, limit: number = 10) => {
  try {
    // クエリを構築
    let query = firestore()
      .collection('boardPosts')
      .where('circleId', '==', circleId)
      // 注意: parentId == nullのクエリが機能していないため、クライアント側でフィルタリングする
      .orderBy('createdAt', 'desc')
      .limit(limit);
    
    if (lastVisible) {
      query = query.startAfter(lastVisible);
    }
    
    // クエリを実行してエラーハンドリング
    try {
      // 最新データを取得するために明示的にサーバーから取得する
      // ただし、lastVisibleがあるとき（追加ロード時）はキャッシュも使用してパフォーマンス向上
      const source = lastVisible ? 'default' : 'server';
      const snapshot = await query.get({ source: source as 'default' | 'server' | 'cache' });
      
      if (snapshot.empty) {
        return { posts: [], lastVisible: null };
      }
      
      // 親投稿のみをフィルタリング - クライアント側で行う
      const posts = snapshot.docs
        .map(doc => {
          const data = doc.data();
          // タイムスタンプが適切に取得できていることを確認
          const createdAt = data.createdAt ? data.createdAt : firestore.Timestamp.now();
          
          // テキストデータの確認と整形
          let text = data.text || '';
          // 改行コードや特殊文字の修正
          if (typeof text === 'string') {
            text = text.replace(/\\n/g, '\n').trim();
          }
          
          // 重要なデータをログ出力（デバッグ用）
          console.log(`投稿データ: ID=${doc.id}, parentId=${data.parentId || 'null'}, replyCount=${data.replyCount || 0}`);
          
          return { 
            id: doc.id, 
            ...data,
            text,
            createdAt 
          } as BoardPost;
        })
        .filter(post => !post.parentId) // 親投稿のみをクライアント側でフィルタリング
        .map(post => {
          // IDが適切に設定されていることを確認
          if (!post.id || post.id === '.') {
            const uniqueId = `generated-${Math.random().toString(36).substring(2, 15)}`;
            return { ...post, id: uniqueId };
          }
          
          // likesが配列でない場合の対応
          if (!Array.isArray(post.likes)) {
            post.likes = [];
          }
          
          return post;
        });
      
      // 結果がフィルタリングで空になった場合
      if (posts.length === 0) {
        return { posts: [], lastVisible: null };
      }
      
      const newLastVisible = snapshot.docs[snapshot.docs.length - 1];
      
      return { posts, lastVisible: newLastVisible };
    } catch (error: any) {
      console.error('投稿取得エラー:', error.code, error.message);
      
      // 権限エラーの場合は空の結果を返す
      if (error.code === 'permission-denied') {
        throw error; // 呼び出し元でエラー処理ができるように例外を投げる
      }
      
      // 他のエラーは上位に伝播
      throw error;
    }
  } catch (error) {
    console.error('サークル掲示板の投稿取得に失敗:', error);
    throw error;
  }
};

/**
 * イベントの掲示板投稿を取得する
 */
export const getEventBoardPosts = async (eventId: string, lastVisible: any = null, limit = 20) => {
  if (!eventId) {
    throw new Error('イベントIDが必要です');
  }

  try {
    console.log(`掲示板投稿取得開始: イベントID=${eventId}`);
    
    // クエリを構築 - サークル掲示板と同様の方法で
    let query = firestore()
      .collection('boardPosts')
      .where('eventId', '==', eventId)
      // parentId == null のフィルタリングはクライアント側で行う（クエリの制約回避）
      .orderBy('createdAt', 'desc'); // 新しい順
    
    // ページネーション
    if (lastVisible) {
      console.log('続きの投稿を取得中 (lastVisible あり)');
      query = query.startAfter(lastVisible);
    } else {
      console.log('最初のページを取得中');
    }
    
    // 取得件数制限
    query = query.limit(limit);
    
    console.log('Firestoreクエリ実行...');
    
    // サークル掲示板と同様にキャッシュ戦略を設定
    // 最初の読み込み時はサーバーから、追加読み込み時はキャッシュも許可
    const source = lastVisible ? 'default' : 'server';
    console.log(`データソース: ${source} (${lastVisible ? '追加読み込み' : '初期読み込み'})`);
    
    // クエリを実行
    const snapshot = await query.get({ source: source as 'default' | 'server' | 'cache' });
    
    if (snapshot.empty) {
      console.log('掲示板投稿が見つかりませんでした');
      return { posts: [], lastVisible: null };
    }
    
    console.log(`クエリ結果: ${snapshot.size}件の投稿を取得`);
    
    // 投稿データを配列に変換し、クライアント側でフィルタリング
    const posts = snapshot.docs
      .map(doc => {
        const data = doc.data();
        // createdAtがTimestampでない場合も考慮
        const createdAt = data.createdAt?.toDate ? data.createdAt : (data.createdAt || new Date());
        
        // データの検証と整形
        if (data.createdAt && !data.createdAt.toDate) {
          console.warn(`警告: createdAtがTimestampでありません: ${data.createdAt}, postId=${doc.id}`);
        }
        
        // 親IDの有無をログ出力
        console.log(`投稿データ: ID=${doc.id}, ユーザーID=${data.userId}, parentId=${data.parentId || 'null'}`);
        
        return { 
          id: doc.id, 
          ...data,
          // タイムスタンプをDateオブジェクトに統一
          createdAt: createdAt,
          // likesが配列でない場合の対応
          likes: Array.isArray(data.likes) ? data.likes : [],
        } as BoardPost;
      })
      // 親投稿のみをフィルタリングする処理をコメントアウト
      // 親投稿と返信の両方を含めるため
      // .filter(post => !post.parentId)
      // データの整合性を確保
      .map(post => {
        // IDの検証
        if (!post.id || post.id === '.') {
          const uniqueId = `generated-${Math.random().toString(36).substring(2, 15)}`;
          return { ...post, id: uniqueId };
        }
        return post;
      });
    
    // クライアント側フィルタリング後に結果が空かチェック
    if (posts.length === 0) {
      console.log('フィルタリング後の投稿が0件です');
      return { posts: [], lastVisible: null };
    }
    
    // データの整合性を確認
    if (posts.length > 0) {
      // 最新の投稿の日時をログ
      const latestPost = posts[0];
      console.log(`最新投稿: ID=${latestPost.id}, 作成日=${latestPost.createdAt}, テキスト=${latestPost.text?.substring(0, 20) || ''}...`);
    }
    
    // 最後の要素（次のページ取得用）
    const newLastVisible = snapshot.docs[snapshot.docs.length - 1];
    console.log(`取得結果: ${posts.length}件の投稿, lastVisible=${newLastVisible ? 'あり' : 'なし'}`);
    
    return { 
      posts, 
      lastVisible: newLastVisible 
    };
  } catch (error) {
    console.error('❌ イベント掲示板の投稿取得エラー:', error);
    
    // エラーメッセージをより詳細に
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        console.error('権限エラー: イベントのメンバーではない可能性があります');
        throw new Error('権限がありません。イベント参加者のみが掲示板を閲覧できます。');
      } else if (error.message.includes('unavailable') || error.message.includes('network')) {
        console.error('ネットワークエラー: オフラインまたはFirestoreに接続できません');
        throw new Error('ネットワーク接続を確認してください。オフラインでは掲示板を読み込めません。');
      } else {
        throw error;
      }
    } else {
      throw new Error('掲示板の投稿取得に失敗しました');
    }
  }
};

// 投稿の返信を取得
export const getReplies = async (parentId: string, circleId?: string, eventId?: string) => {
  try {
    console.log(`===== 返信取得開始: 親投稿ID=${parentId} =====`);
    
    // クエリを構築
    let query = firestore()
      .collection('boardPosts')
      .where('parentId', '==', parentId);
      
    if (circleId) {
      console.log(`サークル掲示板の返信取得: circleId=${circleId}`);
      // サークルIDを条件に追加（セキュリティルールでの権限チェック用）
      query = query.where('circleId', '==', circleId);
    } else if (eventId) {
      console.log(`イベント掲示板の返信取得: eventId=${eventId}`);
      // イベントIDを条件に追加（セキュリティルールでの権限チェック用）
      query = query.where('eventId', '==', eventId);
    }
    
    // 返信を取得
    const snapshot = await query
      .orderBy('createdAt', 'asc')
      .get({ source: 'server' }); // サーバーから確実に最新データを取得
    
    if (snapshot.empty) {
      console.log(`返信なし: 親投稿ID=${parentId}`);
      return [];
    }
    
    const replies = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`返信データ: ID=${doc.id}, 親投稿ID=${data.parentId}, 返信先ID=${data.replyToId || 'なし'}`);
      return { id: doc.id, ...data } as BoardPost;
    });
    
    console.log(`返信取得完了: 親投稿ID=${parentId}, 件数=${replies.length}`);
    
    // 返信件数が実際の数と異なる場合は親投稿の返信カウントを更新
    try {
      const parentDoc = await firestore().collection('boardPosts').doc(parentId).get();
      if (parentDoc.exists) {
        const parentData = parentDoc.data();
        const currentReplyCount = parentData?.replyCount || 0;
        
        if (currentReplyCount !== replies.length) {
          console.log(`親投稿の返信数を修正: ID=${parentId}, 現在の値=${currentReplyCount}, 実際の値=${replies.length}`);
          await firestore()
            .collection('boardPosts')
            .doc(parentId)
            .update({
              replyCount: replies.length
            });
        }
      }
    } catch (countError) {
      // 返信数の更新に失敗しても、返信取得自体は成功しているのでエラーはログのみ
      console.warn('返信数の更新に失敗:', countError);
    }
    
    return replies;
  } catch (error) {
    console.error('返信取得エラー:', error);
    throw error;
  }
};

// 掲示板に投稿する
export const createBoardPost = async (userId: string, postData: PostCreationData) => {
  try {
    console.log('===== 投稿作成開始 =====');
    console.log('投稿者ID:', userId);
    console.log('投稿データ:', JSON.stringify({
      ...postData,
      text: postData.text?.substring(0, 20) + (postData.text && postData.text.length > 20 ? '...' : ''),
      hasImage: !!postData.imageUrl
    }));
    
    // サークル投稿かイベント投稿か判断し、環境情報をログ出力
    if (postData.circleId) {
      console.log('投稿タイプ: サークル掲示板投稿');
      console.log('サークルID:', postData.circleId);
      
      if (postData.parentId) {
        console.log('投稿種別: 返信投稿（親投稿ID:', postData.parentId, '）');
      } else {
        console.log('投稿種別: 親投稿');
      }
    } else if (postData.eventId) {
      console.log('投稿タイプ: イベント掲示板投稿');
      console.log('イベントID:', postData.eventId);
      
      if (postData.parentId) {
        console.log('投稿種別: 返信投稿（親投稿ID:', postData.parentId, '）');
      } else {
        console.log('投稿種別: 親投稿');
      }
    }

    // メンバーシップ確認は行わない（誰でも投稿可能に）
    // Firestoreセキュリティルールで制御する

    // 新しい投稿ドキュメント用のリファレンスを作成
    const postRef = firestore().collection('boardPosts').doc();
    console.log('新規投稿ID:', postRef.id);
    
    // 投稿データの構築
    const newPost: any = {
      userId,  // 投稿者ID
      text: postData.text,  // 投稿テキスト
      createdAt: firestore.FieldValue.serverTimestamp(),  // サーバーのタイムスタンプ
      likes: [],  // いいね配列（初期値は空）
      replyCount: 0,  // 返信数（初期値は0）
    };
    
    // 条件付きでフィールドを追加
    if (postData.circleId) newPost.circleId = postData.circleId;
    if (postData.eventId) newPost.eventId = postData.eventId;
    if (postData.imageUrl) newPost.imageUrl = postData.imageUrl;
    if (postData.parentId) newPost.parentId = postData.parentId;
    if (postData.replyToId) newPost.replyToId = postData.replyToId;
    
    // Firestoreへの書き込み
    try {
      console.log('Firestoreに投稿データを書き込み中...');
      await postRef.set(newPost);
      console.log('✅ 投稿データの書き込み成功');
      
      // イベント掲示板の場合、投稿後に確実に読み込めるようにセキュリティルールを再確認
      if (postData.eventId) {
        try {
          // イベント参加確認
          const eventDoc = await firestore().collection('events').doc(postData.eventId).get();
          if (eventDoc.exists) {
            const eventData = eventDoc.data() || {};
            const isCreator = eventData.createdBy === userId;
            const isAdmin = (eventData.admins || []).includes(userId);
            const isAttendee = (eventData.attendees || []).includes(userId);
            console.log('イベント参加状態確認:', { 
              isCreator, 
              isAdmin, 
              isAttendee,
              userId,
              eventCreator: eventData.createdBy
            });
          }
        } catch (err) {
          console.warn('イベント参加確認エラー（続行します）:', err);
        }
      }
    } catch (writeError: any) {
      console.error('❌ 投稿データの書き込み失敗:', writeError);
      
      // Firestore権限エラーの詳細なハンドリング
      if (writeError.code === 'permission-denied') {
        console.error('権限エラー: Firestoreルールにより操作が拒否されました');
        throw new Error('投稿する権限がありません。イベント参加者またはサークルメンバーであることを確認してください。');
      }
      throw writeError;
    }
    
    // 親投稿がある場合（返信の場合）は返信カウントを更新
    if (postData.parentId) {
      try {
        console.log('親投稿の返信カウントを更新中...', { parentId: postData.parentId });
        
        // 親投稿の現在の返信数を確認
        const parentRef = firestore().collection('boardPosts').doc(postData.parentId);
        
        // incrementを使用した安全な更新
        try {
          console.log('FieldValue.incrementで返信数を更新します');
          await parentRef.update({
            replyCount: firestore.FieldValue.increment(1)
          });
          console.log('✅ 親投稿の返信数を更新しました');
        } catch (incrementError) {
          console.warn('返信数更新エラー:', incrementError);
          // エラーは記録するだけで続行（投稿自体は成功）
        }
      } catch (finalError) {
        // 返信数更新エラーは投稿全体の失敗とはしない
        console.warn('返信数更新中にエラーが発生しましたが、投稿処理は続行します:', finalError);
      }
    }
    
    console.log('新規投稿のデータを取得中...');
    // FieldValueからTimestampに変換するため、投稿を再取得
    try {
      // 短い遅延を入れてサーバーが確実に処理を完了するのを待つ
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const postDoc = await postRef.get({ source: 'server' });
      if (!postDoc.exists) {
        console.warn('⚠️ 投稿が見つかりませんでした（存在確認）');
        // 最大3回まで再試行
        for (let i = 0; i < 3; i++) {
          console.log(`投稿存在確認再試行 (${i + 1}/3)...`);
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
          const retryDoc = await postRef.get({ source: 'server' });
          if (retryDoc.exists) {
            console.log('✅ 再試行後に投稿が見つかりました');
            return { id: postRef.id, ...retryDoc.data() } as BoardPost;
          }
        }
      }
      
      console.log('✅ 投稿作成完了:', postRef.id);
      return { id: postRef.id, ...postDoc.data() } as BoardPost;
    } catch (getError) {
      // 投稿は成功しているが、データ取得に失敗した場合
      console.warn('⚠️ 投稿データの再取得に失敗（投稿自体は成功）:', getError);
      // 仮のデータを返す
      return { 
        id: postRef.id,
        userId,
        text: postData.text,
        createdAt: new Date(),
        likes: [],
        replyCount: 0,
        ...(postData.circleId && { circleId: postData.circleId }),
        ...(postData.eventId && { eventId: postData.eventId }),
        ...(postData.imageUrl && { imageUrl: postData.imageUrl }),
        ...(postData.parentId && { parentId: postData.parentId }),
        ...(postData.replyToId && { replyToId: postData.replyToId }),
      } as BoardPost;
    }
  } catch (error) {
    console.error('===== 投稿作成エラー =====', error);
    
    // エラーメッセージを詳細に
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        console.error('権限エラーの詳細:', error.message);
        throw new Error('投稿する権限がありません。イベント参加者またはサークルメンバーであることを確認してください。');
      } else if (error.message.includes('not-found')) {
        throw new Error('サークルまたはイベントが見つかりません。');
      } else if (error.message.includes('unavailable')) {
        throw new Error('ネットワークエラー: サービスが一時的に利用できません。');
      }
    }
    
    // その他のエラーはそのまま再スロー
    throw error;
  }
};

// 投稿にいいねする/いいねを取り消す
export const toggleLikeBoardPost = async (postId: string, userId: string, isLiked: boolean) => {
  try {
    const postRef = firestore().collection('boardPosts').doc(postId);
    
    if (isLiked) {
      // いいねを取り消す
      await postRef.update({
        likes: firestore.FieldValue.arrayRemove(userId)
      });
    } else {
      // いいねする
      await postRef.update({
        likes: firestore.FieldValue.arrayUnion(userId)
      });
    }
    
    return !isLiked;
  } catch (error) {
    console.error('Error toggling like on board post:', error);
    throw error;
  }
};

// 画像をアップロードして投稿に添付
export const uploadBoardImage = async (imagePath: string, circleId?: string, eventId?: string) => {
  try {
    // ストレージのパスを決定
    const prefix = circleId ? `circles/${circleId}` : `events/${eventId}`;
    const fileName = `${prefix}/posts/${Date.now()}.jpg`;
    const reference = storage().ref(fileName);
    
    // 画像をアップロード
    await reference.putFile(imagePath);
    
    // 画像のURLを取得
    const url = await reference.getDownloadURL();
    
    return url;
  } catch (error) {
    console.error('Error uploading board image:', error);
    throw error;
  }
};

// 投稿を削除する (自分の投稿のみ削除可能)
export const deleteBoardPost = async (postId: string, userId: string) => {
  try {
    console.log('投稿削除処理開始:', { postId, userId });
    
    // バッチ処理を作成
    const batch = firestore().batch();
    const postRef = firestore().collection('boardPosts').doc(postId);
    
    // まず投稿を確認
    const postDoc = await postRef.get();
    
    if (!postDoc.exists) {
      throw new Error('投稿が見つかりません');
    }
    
    const postData = postDoc.data() as BoardPost;
    
    // 投稿者のみ削除可能 - ここで本当にユーザーIDが一致しているか確認
    if (postData.userId !== userId) {
      console.error('削除権限エラー:', { postUserId: postData.userId, currentUserId: userId });
      throw new Error('この投稿を削除する権限がありません');
    }
    
    // 親投稿があれば、その親投稿の返信数を減らす
    if (postData.parentId) {
      const parentRef = firestore().collection('boardPosts').doc(postData.parentId);
      const parentDoc = await parentRef.get();
      
      if (parentDoc.exists) {
        batch.update(parentRef, {
          replyCount: firestore.FieldValue.increment(-1)
        });
      }
    }
    
    // 削除する投稿が親投稿の場合、すべての返信も削除
    if (!postData.parentId) {
      // 返信を取得
      const repliesSnapshot = await firestore()
        .collection('boardPosts')
        .where('parentId', '==', postId)
        .get();
      
      // 各返信を削除
      repliesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
    }
    
    // 元の投稿を削除
    batch.delete(postRef);
    
    // バッチ処理を実行
    await batch.commit();
    
    console.log('投稿削除完了:', postId);
    return true;
  } catch (error) {
    console.error('投稿削除エラー:', error);
    throw error;
  }
}; 