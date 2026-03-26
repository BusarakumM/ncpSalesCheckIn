"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const SalesSupportCalendar = dynamic(() => import("@/components/SalesSupportCalendar"), {
  loading: () => (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-gray-700">
      กำลังเตรียมปฏิทิน...
    </div>
  ),
});

export default function HomeCalendarSection({
  employeeNo,
  email,
}: {
  employeeNo?: string;
  email?: string;
}) {
  const [showCalendar, setShowCalendar] = useState(false);

  return (
    <div className="rounded-3xl border border-black/10 bg-[#EDE4CF] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">ปฏิทินการทำงาน</p>
          <p className="text-xs text-gray-700">
            โหลดเฉพาะตอนต้องใช้ เพื่อลดการใช้เน็ตบนมือถือ
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCalendar((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          {showCalendar ? "ซ่อนปฏิทิน" : "โหลดปฏิทิน"}
        </button>
      </div>
      {showCalendar ? (
        <div className="mt-4">
          <SalesSupportCalendar employeeNo={employeeNo} email={email} />
        </div>
      ) : null}
    </div>
  );
}
