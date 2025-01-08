import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { no: string } }
) {
  try {
    const trainNo = params.no
    console.log('正在獲取列車時刻表:', trainNo)

    const response = await fetch(
      `https://taiwanhelper.com/_next/data/i5Qo2rmb7fABQ7fB01Ipa/railway/train/${trainNo}.json?no=${trainNo}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://taiwanhelper.com/'
        },
        next: { revalidate: 300 }  // 5分鐘快取
      }
    )

    if (!response.ok) {
      console.error('API 回應錯誤:', response.status, response.statusText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('成功獲取時刻表資料:', data)

    // 檢查資料結構
    if (!data.pageProps?.train) {
      console.error('無效的資料格式:', data)
      throw new Error('無效的資料格式')
    }

    // 轉換資料格式
    const trainData = {
      no: data.pageProps.train.no,
      trainTypeName: data.pageProps.train.trainTypeName,
      startingStationName: data.pageProps.train.startingStationName,
      endingStationName: data.pageProps.train.endingStationName,
      startingTime: data.pageProps.train.startingTime,
      endingTime: data.pageProps.train.endingTime,
      stopTimes: data.pageProps.train.stopTimes.map((stop: any) => ({
        seq: stop.seq,
        stationId: stop.stationId,
        arrivalTime: stop.arrivalTime,
        departureTime: stop.departureTime
      }))
    }

    return NextResponse.json(trainData)
  } catch (error) {
    console.error('獲取列車時刻表失敗:', error)
    return NextResponse.json(
      { 
        error: '獲取列車時刻表失敗', 
        details: error instanceof Error ? error.message : '未知錯誤',
        no: params.no,
        stopTimes: []
      },
      { status: 500 }
    )
  }
} 