import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { no: string } }
) {
  try {
    const trainNo = params.no
    console.log('正在獲取列車即時資訊:', trainNo)

    const response = await fetch(
      `https://taiwanhelper.com/api/get-train-live?no=${trainNo}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://taiwanhelper.com/'
        },
        next: { revalidate: 30 }  // 30秒快取
      }
    )

    if (!response.ok) {
      console.error('API 回應錯誤:', response.status, response.statusText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('成功獲取即時資訊:', data)

    return NextResponse.json(data)
  } catch (error) {
    console.error('獲取列車即時資訊失敗:', error)
    return NextResponse.json(
      { 
        error: '獲取列車即時資訊失敗', 
        details: error instanceof Error ? error.message : '未知錯誤',
        liveUpdateTime: new Date().toISOString(),
        trainLiveMap: {},
        stationLiveMap: {}
      },
      { status: 500 }
    )
  }
} 