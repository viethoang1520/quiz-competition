'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleHostClick = () => {
    setIsLoading(true);
    router.push('/host');
  };

  const handlePlayerClick = () => {
    setIsLoading(true);
    router.push('/player');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F0F23] via-slate-900 to-[#0F0F23] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-[#E2E8F0]">
              Cuộc Thi Trí Tuệ
            </h1>
            <p className="text-lg text-slate-400">
              Đường Lên Đỉnh Olympia
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleHostClick}
            disabled={isLoading}
            className="w-full py-4 px-6 bg-gradient-to-r from-[#F43F5E] to-red-500 text-white font-semibold rounded-2xl transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-[#F43F5E]/25 focus:outline-none focus:ring-2 focus:ring-[#F43F5E] focus:ring-offset-2 focus:ring-offset-[#0F0F23] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-lg">Làm Quản Trò</span>
            </div>
            <p className="text-sm text-red-200 mt-1">Tạo phòng & điều khiển cuộc thi</p>
          </button>

          <button
            onClick={handlePlayerClick}
            disabled={isLoading}
            className="w-full py-4 px-6 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold rounded-2xl transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-[#7C3AED]/25 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-2 focus:ring-offset-[#0F0F23] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-lg">Tham Gia Thi Đấu</span>
            </div>
            <p className="text-sm text-purple-200 mt-1">Nhập mã phòng để tham gia</p>
          </button>
        </div>

        {/* Connection Status */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-slate-400">
            <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse"></div>
            <span>Kết nối sẵn sàng</span>
          </div>
        </div>

        {/* Info */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>3 Vòng: Khởi động → Vượt chướng ngại vật → Tăng tốc</p>
          <p>Hãy sử dụng ⭐ NGÔI SAO HY VỌNG thật khôn ngoan!</p>
        </div>
      </div>
    </div>
  );
}
