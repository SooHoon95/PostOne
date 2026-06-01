import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "PostOne 개인정보처리방침.",
};

// ⚠️ 초안 — 공개 전 법률 자문 및 [대괄호] 항목(법인 정보·보호책임자·연락처) 확정 필요.
const UPDATED_AT = "2026-06-01";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          개인정보처리방침
        </h1>
        <p className="text-sm text-muted-foreground">최종 개정일: {UPDATED_AT}</p>
      </div>

      <div className="mt-10 space-y-8">
        <Section title="1. 총칙">
          <p>
            PostOne(이하 “서비스”)은 링크드인·스레드·인스타그램에 한 번의 작성으로
            동시 발행하는 멀티채널 퍼블리싱 서비스입니다. 서비스는 외부 플랫폼과
            연동되며, 발행된 콘텐츠에는 각 플랫폼의 약관·정책이 별도로 적용됩니다.
            운영자 [회사명]은 「개인정보 보호법」 등 관계 법령을 준수합니다.
          </p>
        </Section>

        <Section title="2. 수집하는 개인정보 항목">
          <ul className="list-disc space-y-1 pl-5">
            <li>회원 식별: 이메일, 인증 식별자(Supabase Auth user id)</li>
            <li>
              채널 연동 정보: 각 플랫폼(LinkedIn·Threads·Instagram)의 OAuth
              액세스/리프레시 토큰, 계정 식별자, 부여된 권한(scope)
            </li>
            <li>콘텐츠: 본문, 카드뉴스 문구, 발행 이력</li>
            <li>이미지: 업로드한 배경 이미지·자동 생성된 카드뉴스 이미지</li>
            <li>자동 수집: 접속 로그, IP, 기기/브라우저 정보, 쿠키·세션</li>
          </ul>
          <p>민감정보 및 고유식별정보는 수집하지 않습니다.</p>
        </Section>

        <Section title="3. 개인정보의 수집·이용 목적">
          <ul className="list-disc space-y-1 pl-5">
            <li>회원 가입·인증, 로그인 상태 유지</li>
            <li>멀티채널 동시 발행, 카드뉴스 생성·저장·표시</li>
            <li>발행 이력 관리, 문의 대응, 서비스 개선, 부정 이용 방지</li>
            <li>법령상 의무 이행</li>
          </ul>
        </Section>

        <Section title="4. 보유 기간 및 파기">
          <ul className="list-disc space-y-1 pl-5">
            <li>계정 정보: 회원 탈퇴 시까지</li>
            <li>OAuth 토큰: 채널 연동 해제 또는 탈퇴 즉시 삭제</li>
            <li>콘텐츠·이미지: 탈퇴 또는 이용자 삭제 시</li>
            <li>접속 로그: 관계 법령에서 정한 기간</li>
          </ul>
          <p>
            목적 달성·탈퇴 시 해당 정보는 지체 없이 복구 불가능한 방법으로
            파기합니다. 법령상 보존 의무가 있는 항목은 분리 보관 후 기간 만료 시
            파기합니다.
          </p>
        </Section>

        <Section title="5. OAuth 토큰의 처리 및 보안">
          <p>
            채널 연동을 위해 이용자 동의로 발급된 OAuth 토큰은 저장 시 AES-GCM으로
            암호화하며 평문으로 보관하지 않습니다. 토큰은 이용자가 지시한 발행에만
            사용되고, 제3자에게 열람·공유·판매되지 않습니다. 접근은 운영에 필요한
            최소 권한으로 제한되며, 연동 해제·탈퇴·권한 철회 시 즉시 삭제됩니다.
          </p>
        </Section>

        <Section title="6. 개인정보의 제3자 제공">
          <p>
            서비스는 이용자가 직접 지시·동의한 발행을 위해, 작성한 콘텐츠를 해당
            플랫폼(LinkedIn Corporation, Meta Platforms, Inc.)에 전송합니다. 이는
            이용자의 발행 행위를 대행하는 것이며 마케팅·판매 목적의 제공은 하지
            않습니다. 게시 이후의 데이터에는 각 플랫폼의 정책이 적용됩니다.
          </p>
        </Section>

        <Section title="7. 개인정보 처리의 위탁">
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase Inc. — 인증, 데이터베이스, 이미지 스토리지</li>
            <li>Vercel Inc. — 호스팅, 배포, 서버 실행</li>
          </ul>
          <p>
            위 수탁자는 서비스 제공에 필요한 범위에서 개인정보를 처리하며, 데이터는
            국외(미국 등)에서 저장·처리될 수 있습니다. 위탁 계약을 통해 안전성 확보,
            재위탁 제한, 목적 외 처리 금지를 규정합니다.
          </p>
        </Section>

        <Section title="8. 정보주체의 권리 및 행사 방법">
          <p>
            이용자는 자신의 개인정보에 대해 열람·정정·삭제·처리정지·동의 철회·탈퇴를
            요청할 수 있습니다. 서비스 내 설정 또는 아래 문의처를 통해 행사할 수
            있으며, 본인 확인 후 처리합니다. 서비스는 만 14세 미만의 가입을 받지
            않습니다.
          </p>
        </Section>

        <Section title="9. 데이터 삭제 요청 절차">
          <p>
            회원 탈퇴 시 보관 중인 개인정보를 파기하며, 채널 연동 해제·권한 철회 시
            해당 토큰과 연동 데이터를 즉시 삭제합니다. 플랫폼(Meta 등)으로부터 데이터
            삭제 요청 콜백을 수신하면 보관 중인 해당 플랫폼 데이터를 삭제하고 확인
            코드와 상태 조회 경로를 제공합니다. 수동 삭제 요청은 [문의 이메일]로
            접수합니다. 이미 각 플랫폼에 발행된 게시물은 해당 플랫폼에서 직접 삭제해야
            합니다.
          </p>
        </Section>

        <Section title="10. 쿠키 등 자동 수집 장치">
          <p>
            서비스는 로그인 세션 유지를 위해 쿠키를 사용합니다. 브라우저 설정에서
            쿠키 저장을 거부할 수 있으나, 이 경우 로그인 등 일부 기능이 제한될 수
            있습니다.
          </p>
        </Section>

        <Section title="11. 안전성 확보 조치">
          <ul className="list-disc space-y-1 pl-5">
            <li>관리적: 내부 관리계획 수립, 접근 권한 최소화</li>
            <li>
              기술적: HTTPS 전송 암호화, 토큰 AES-GCM 저장 암호화, 접근 통제, 접속
              기록 보관
            </li>
            <li>물리적: Supabase·Vercel의 산업 표준 보안 환경 이용</li>
          </ul>
        </Section>

        <Section title="12. 개인정보 보호책임자 및 문의처">
          <p>
            개인정보 보호책임자: [성명/직책] · 이메일: [보호책임자 이메일]
            <br />
            기타 침해 구제는 개인정보분쟁조정위원회(kopico.go.kr),
            개인정보침해신고센터(privacy.kisa.or.kr) 등에 문의할 수 있습니다.
          </p>
        </Section>

        <Section title="13. 방침의 변경">
          <p>
            본 방침의 변경 시 시행 7일 전(중대한 변경은 30일 전) 서비스 내 공지를
            통해 안내합니다.
          </p>
        </Section>
      </div>
    </div>
  );
}
