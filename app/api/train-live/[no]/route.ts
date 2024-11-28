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
        }
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('獲取列車即時資訊失敗:', error)
    return NextResponse.json(
      { error: 'Failed to fetch train live data', details: error.message },
      { status: 500 }
    )
  }
} 