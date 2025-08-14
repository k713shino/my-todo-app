import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  await optimizeForLambda()
  
  return measureLambdaPerformance('PUT /api/user/update', async () => {
    try {
      const session = await getAuthSession()
      
      if (!isAuthenticated(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { name, image } = await request.json()

      if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      }

      // ユーザー情報を更新
      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          name: name.trim(),
          image: image || null
        }
      })

      console.log('✅ User updated successfully:', updatedUser.id)

      return NextResponse.json({
        success: true,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          image: updatedUser.image
        }
      })

    } catch (error) {
      console.error('❌ User update error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}