# PostOne 출시 계획 & 체크리스트

> 목표: **매출이 일정 이상 안정될 때까지 현금 $0**로 운영하고, 안정되면 유료 매니지드로 졸업.
> 핵심 원칙: **Supabase API 표면을 끝까지 유지** → 매니지드 ↔ 셀프호스팅 이동이 *환경변수 교체* 수준(락인 없음).

---

## 3단계 로드맵

| Phase | 시점 | 스택 | 비용 | 상업성 |
|---|---|---|---|---|
| **0** | 지금 ~ 베타 | Vercel(Hobby) + Supabase(Free) + Resend(Free) | $0 | 비상업(매출 X) |
| **1** | 정식 배포 직전 | **OCI Always-Free VM**에 Supabase 셀프호스팅(오픈소스 Docker) + Resend + 이미지(OCI Object Storage/R2) | $0 | **상업 OK** |
| **2** | 매출 안정 이후 | 매니지드 Supabase(Pro) 또는 매니지드 Postgres + Vercel(Pro) | 유료 | 상업 |

**왜 배포 직전에 OCI로?** Vercel **Hobby는 "비상업 전용"** — 결제(Toss) 붙는 순간 약관 위반. 그 시점에 Vercel Pro($20/월)를 내거나 **OCI 무료 VM(상업 허용)** 으로 옮겨야 함. 매출 전까진 Vercel Hobby로 $0 유지.

---

## ✅ 내가(사용자) 해야 할 일

### A. 지금 — 이메일 살리기 (무료, ~5분) ⚠️ 최우선
현재 `mailer_autoconfirm=true`(Confirm email OFF) 라 **메일이 아예 안 나가고 가입이 자동 통과** 중. (증거: `isanghoony@gmail.com` 생성=확인 시각 동일)

- [ ] Supabase 대시보드 → Authentication → **Email → "Confirm email" 토글 ON**
- [ ] **Resend** 가입 → 도메인 인증 → Supabase → Authentication → **SMTP 설정**에 입력
      (host `smtp.resend.com`, port `465`, user `resend`, pass = Resend API key)
- [ ] Supabase → URL Configuration: Site URL = `https://postone-sigma.vercel.app`,
      Redirect URLs += `https://postone-sigma.vercel.app/**`, `http://localhost:3000/**`
- [ ] Vercel 환경변수 `NEXT_PUBLIC_APP_URL=https://postone-sigma.vercel.app` 확인
- [ ] 검증: 가입 → 메일 수신 (Claude가 Gmail로 도착 확인 가능)

### B. 플랫폼 연결
**지금(심사 없이 특정 계정만):**
- [ ] Instagram: App Roles + Instagram Tester 초대 → 인스타 앱에서 수락
- [ ] Threads: App Roles → Threads Tester 초대 → 수락
- [ ] LinkedIn: 앱 팀 멤버로 추가

**정식 공개(모두 사용):**
- [ ] Meta: App Settings→Basic 전부(아이콘 1024², Privacy=`/privacy`, Terms=`/terms`, Data Deletion), Business Verification, App Review(권한별 시연영상+사유), Live 전환
- [ ] LinkedIn: LinkedIn Page 연결, Products에 "Sign In with LinkedIn(OIDC)" + "Share on LinkedIn" 추가, 앱 검증
- [ ] 대시보드 콜백 URL 등록:
  ```
  IG  Deauthorize    https://postone-sigma.vercel.app/api/instagram/deauthorize
  IG  Data Deletion  https://postone-sigma.vercel.app/api/instagram/data-deletion
  Threads Deauth     https://postone-sigma.vercel.app/api/threads/deauthorize
  Threads Deletion   https://postone-sigma.vercel.app/api/threads/data-deletion
  ```

### C. 법무 placeholder 채우기 (제출 전)
- [ ] `/privacy`: `[회사명]`·보호책임자 `[성명/직책]`·`[보호책임자 이메일]`·`[문의 이메일]`
- [ ] `/terms`: `[회사명]`·`[대표자]`·`[사업자등록번호]`·`[관할 법원]`·`[이메일]`
- [ ] `/data-deletion-status`: `[문의 이메일]`
- [ ] 각 파일 상단 `// ⚠️ 초안` 주석 제거 (법무 검토 후)

### D. Phase 1 — OCI 이전 (배포 직전)
- [ ] OCI Always-Free **ARM VM** 생성 (Ampere A1; 인기 리전은 용량부족 시 재시도/리전 변경)
- [ ] Docker로 **Supabase 셀프호스팅**(`supabase/docker` compose) — Postgres+Auth(GoTrue)+Storage
- [ ] **Caddy** 리버스프록시(자동 HTTPS) + 도메인 연결
- [ ] 데이터 이전: 매니지드 Supabase에서 `pg_dump` → 셀프호스팅 restore
- [ ] env 교체(`NEXT_PUBLIC_SUPABASE_URL`/키를 셀프호스팅 값으로) → 검증
- [ ] 이미지: OCI Object Storage(~20GB 무료) 또는 Cloudflare R2(10GB·egress $0)
- [ ] 이메일: Resend SMTP 그대로(셀프호스팅 SMTP 금지 — 도달률)

### E. Phase 2 — 졸업 (매출 안정)
- [ ] 매니지드 Supabase Pro 또는 매니지드 Postgres + Vercel Pro로 env 교체

---

## 🤖 코드 (Claude 담당)
- [x] 이메일 인증 플로우 (가입 게이팅·verify-email·재발송·콜백 하드닝·가드) — 커밋 `1a1c2a2`
- [x] App Review 사전요건 (privacy/terms/IG 콜백/삭제상태/푸터) — 커밋 `39e6c21`
- [~] **카드 이미지 JPEG 전환** (1.47MB→~200KB, 스토리지 5~10× + 인스타 호환) — 이번 라운드
- [ ] (Phase 1 시) 스토리지 어댑터: 이미지 저장을 R2/OCI로 env 스위치 (`lib/cards/upload.ts` 국소 변경)
- [ ] **푸시 대기**: 승인 시 `git push origin main` → Vercel 자동 배포

---

## 무료 한도 (2026 확인)

| 서비스 | 무료 | 비고 |
|---|---|---|
| Supabase Free | 500MB DB · **1GB 스토리지** · 50K MAU · 10GB egress/월 | 스토리지가 먼저 참 → JPEG+R2로 해결 |
| Resend Free | **3,000/월 · 100/일** | 이메일 인증엔 충분 |
| Cloudflare R2 | **10GB · egress $0(무제한)** | 이미지 서빙 최적 |
| OCI Always Free | ARM VM(~4코어/24GB) · ~20GB Object Storage · 시간제한 없음 | 상업 호스팅 $0(직접 운영) |
| Vercel Hobby | 100GB 대역폭 | ⚠️ **비상업 전용** |

출처: Supabase Pricing, Resend Pricing, Cloudflare R2 Pricing, Vercel Hobby/Fair-Use(상업 금지), OCI Always Free.

---

## 트레이드오프(정직하게)
- 셀프호스팅(Phase 1) = **현금 $0 대신 운영 시간**: OS/Docker 업데이트, Postgres 백업, TLS, 모니터링이 본인 책임.
- OCI ARM 무료 인스턴스는 인기 리전에서 **용량부족 생성실패**가 잦음(재시도).
- 이메일은 어느 단계든 **Resend(외부 SMTP)** 사용 — 셀프호스팅 SMTP 금지.
