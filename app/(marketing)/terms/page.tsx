import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "PostOne 이용약관.",
};

// ⚠️ 초안 — 공개 전 법률 자문 및 [대괄호] 항목(법인 정보·관할) 확정 필요.
const UPDATED_AT = "2026-06-01";

function Article({
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

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          이용약관
        </h1>
        <p className="text-sm text-muted-foreground">최종 개정일: {UPDATED_AT}</p>
      </div>

      <div className="mt-10 space-y-8">
        <Article title="제1조 (목적)">
          <p>
            본 약관은 PostOne(이하 “서비스”)이 제공하는 멀티채널 동시 발행 서비스의
            이용 조건과 절차, 회사와 이용자의 권리·의무 및 책임을 규정함을 목적으로
            합니다.
          </p>
        </Article>

        <Article title="제2조 (정의)">
          <ul className="list-disc space-y-1 pl-5">
            <li>“서비스”: 한 번의 작성으로 연동된 채널에 동시 발행하는 도구</li>
            <li>“회원”: 본 약관에 동의하고 계정을 생성한 이용자</li>
            <li>
              “연동 채널”: 회원이 OAuth로 연결한 LinkedIn·Threads·Instagram 계정
            </li>
            <li>“콘텐츠”: 회원이 작성·업로드한 본문·카드뉴스·이미지</li>
          </ul>
        </Article>

        <Article title="제3조 (약관의 효력 및 변경)">
          <p>
            본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 회사는 관련 법령을
            위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 시행 7일 전(중대한
            변경은 30일 전) 공지합니다. 변경에 동의하지 않는 회원은 이용을 중단하고
            탈퇴할 수 있습니다.
          </p>
        </Article>

        <Article title="제4조 (회원가입 및 계정)">
          <p>
            회원가입은 이메일 인증을 통해 이루어지며, 만 14세 이상만 가입할 수
            있습니다. 회원은 1개의 계정을 보유하며, 계정 정보의 정확성과 보안 관리에
            대한 책임을 집니다.
          </p>
        </Article>

        <Article title="제5조 (외부 플랫폼 연동 및 권한)">
          <p>
            회원은 OAuth를 통해 발행 권한을 서비스에 위임하며, 서비스는 부여된 권한
            범위 내에서만 동작합니다. 회원은 각 플랫폼의 약관을 준수해야 하며, 플랫폼의
            정책 변경 또는 API 중단 시 일부 기능이 제한될 수 있습니다. 발급된 토큰은
            발행 목적으로만 사용되고 암호화되어 보관되며 무단 공유되지 않습니다.
          </p>
        </Article>

        <Article title="제6조 (서비스의 내용)">
          <p>
            서비스는 동시 발행, 카드뉴스 자동 생성, 배경 이미지 업로드·저장, 발행 이력
            관리 등을 제공합니다. 유료 기능이 도입되는 경우 요금·결제·환불 조건을 별도로
            고지합니다. 회사는 서비스의 내용을 변경하거나 중단할 수 있습니다.
          </p>
        </Article>

        <Article title="제7조 (이용자의 의무 및 금지행위)">
          <ul className="list-disc space-y-1 pl-5">
            <li>타인의 명의·계정 도용 및 무단 계정 연동 금지</li>
            <li>불법·권리침해·스팸·플랫폼 정책 위반 콘텐츠 발행 금지</li>
            <li>API 우회, 과도한 호출, 자동화 남용 등 시스템 부하 행위 금지</li>
            <li>서비스의 역설계 및 무단 데이터 수집 금지</li>
          </ul>
        </Article>

        <Article title="제8조 (콘텐츠의 권리 및 책임)">
          <p>
            콘텐츠의 권리는 회원에게 귀속됩니다. 회원은 서비스가 발행·저장·표시에
            필요한 범위에서 콘텐츠를 사용하도록 허락합니다. 업로드한 이미지의 저작권·
            초상권 등 적법성과 발행으로 인한 분쟁에 대한 책임은 회원에게 있습니다.
          </p>
        </Article>

        <Article title="제9조 (개인정보 보호)">
          <p>
            개인정보의 처리는 별도의 개인정보처리방침에 따릅니다. 토큰 암호화 및 데이터
            삭제 절차는 개인정보처리방침을 참조하시기 바랍니다.
          </p>
        </Article>

        <Article title="제10조 (계정 해지·연동 해제 및 데이터 삭제)">
          <p>
            회원은 언제든지 연동 해제 또는 탈퇴할 수 있습니다. 탈퇴 시 토큰·콘텐츠·
            이미지를 파기하며, 플랫폼의 권한 철회·삭제 요청 콜백에 따라 해당 데이터를
            삭제합니다. 이미 발행된 게시물은 각 플랫폼에서 직접 삭제해야 합니다.
          </p>
        </Article>

        <Article title="제11조 (서비스의 중단·변경)">
          <p>
            회사는 점검·장애·플랫폼 API 변경·불가항력 등의 사유로 서비스를 중단하거나
            변경할 수 있으며, 가능한 범위에서 사전 또는 사후에 공지합니다.
          </p>
        </Article>

        <Article title="제12조 (책임의 한계)">
          <p>
            회사는 발행 결과(노출·도달·삭제·계정 제재 등)를 보증하지 않으며, 플랫폼
            API 장애·정책 변경·계정 정지로 인한 손해, 회원 콘텐츠의 위법성 및 제3자
            분쟁, 천재지변·회원 귀책으로 인한 손해에 대해 법이 허용하는 범위에서 책임을
            지지 않습니다.
          </p>
        </Article>

        <Article title="제13조 (준거법 및 분쟁 해결)">
          <p>
            본 약관은 대한민국 법을 준거법으로 하며, 분쟁은 관계 법령에 따른 절차와
            [관할 법원]을 통해 해결합니다.
          </p>
        </Article>

        <Article title="제14조 (문의처)">
          <p>
            상호 [회사명] · 대표 [대표자] · 사업자등록번호 [번호] · 문의 [이메일]
          </p>
        </Article>
      </div>
    </div>
  );
}
