import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">설정</h1>
      <ul className="space-y-2 text-sm">
        <li>
          <Link href="/settings/connections" className="underline">
            채널 연동
          </Link>
        </li>
      </ul>
    </div>
  );
}
