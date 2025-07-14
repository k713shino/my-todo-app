#!/bin/bash

echo "🔍 AWS RDS接続問題の診断を開始..."

# 1. RDSインスタンス情報の確認
echo "📊 RDSインスタンス情報を確認中..."
aws rds describe-db-instances --db-instance-identifier my-todo-app-db --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port,VpcSecurityGroups:VpcSecurityGroups[0].VpcSecurityGroupId}' --output table 2>/dev/null || echo "❌ AWS CLIが設定されていないか、RDSインスタンスが見つかりません"

# 2. 現在のIPアドレスを確認
echo "🌐 現在のIPアドレスを確認中..."
CURRENT_IP=$(curl -s http://checkip.amazonaws.com || curl -s http://ipinfo.io/ip || echo "IPアドレスの取得に失敗")
echo "現在のIPアドレス: $CURRENT_IP"

# 3. 接続テスト
echo "🔗 データベース接続テストを実行中..."

# DNS解決テスト
echo "DNS解決テスト:"
nslookup my-todo-app-db.cfcy8c2wq7lr.ap-northeast-1.rds.amazonaws.com || echo "❌ DNS解決に失敗"

# ポート接続テスト
echo "ポート5432接続テスト:"
timeout 5 bash -c '</dev/tcp/my-todo-app-db.cfcy8c2wq7lr.ap-northeast-1.rds.amazonaws.com/5432' 2>/dev/null && echo "✅ ポート5432に接続可能" || echo "❌ ポート5432に接続できません"

# 4. 推奨解決策
echo ""
echo "🛠️ 推奨解決策:"
echo "1. AWS RDSセキュリティグループで以下のIPアドレスを許可:"
echo "   - 現在のIP: $CURRENT_IP/32"
echo "   - または一時的に全て許可: 0.0.0.0/0 (注意: セキュリティリスクあり)"
echo ""
echo "2. AWS CLIコマンド例:"
echo "   aws ec2 authorize-security-group-ingress \\"
echo "     --group-id sg-xxxxxxxxx \\"  
echo "     --protocol tcp \\"
echo "     --port 5432 \\"
echo "     --cidr $CURRENT_IP/32"
echo ""
echo "3. AWS Consoleでの設定:"
echo "   - RDS → Databases → my-todo-app-db → Connectivity & security"
echo "   - Security groups をクリック"
echo "   - Inbound rules を編集"
echo "   - Type: PostgreSQL, Port: 5432, Source: $CURRENT_IP/32 を追加"