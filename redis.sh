# 🎀 修正版 AWS ElastiCache Redis クラスター作成コマンド

echo "🔴 Redis クラスターを作成中ですわ..."

# 正しいパラメーター名で実行
aws elasticache create-replication-group \
    --replication-group-id todo-app-redis-prod \
    --replication-group-description "Todo App Redis Production" \
    --cache-node-type cache.t3.micro \
    --engine redis \
    --num-cache-clusters 1 \
    --port 6379

# 作成状況を確認
echo "📊 Redis クラスターの作成状況を確認中..."
aws elasticache describe-replication-groups \
    --replication-group-id todo-app-redis-prod

# エンドポイント取得（作成完了後に実行）
echo "🔗 Redis エンドポイントを取得中..."
aws elasticache describe-replication-groups \
    --replication-group-id todo-app-redis-prod \
    --query 'ReplicationGroups[0].RedisEndpoint.Address' \
    --output text

echo "✨ Redis クラスター作成コマンド完了ですわ！"