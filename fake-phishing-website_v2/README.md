# fake-phishing-website — AI 해커톤 레트로 배너 광고판

이 산출물은 GitHub `seonbaldae/fake-phishing-website`의 `public` + `vercel.json` 구조에 **덮어씌워 병합하는 오버레이 패키지**입니다. 독립적인 새 Git 저장소가 아닙니다.

## 프런트엔드 기술 스택

- **순수 JavaScript (ES modules)**: React/Vue/jQuery/TypeScript, 번들러, 외부 CDN 없음.
- **Shadow DOM**: 모든 시각·상호작용 컴포넌트는 `attachShadow({ mode: 'open' })`로 스타일·마크업 캡슐화. 공용 `styles.css`는 각 Shadow Root 안에서 로드.
- **적극적 Web Components 컴포넌트화**: `demo-banner`, `site-header`, `countdown-timer`, `prize-hero`, `prize-ticket`, `safety-ticker`, `red-flags`, `red-flag-card`, `site-footer`, `explanation-dialog` 재사용 + 새 목적별 `retro-ad-board`, `retro-ad-tile`, `retro-ad-banner`, `retro-motion-toggle`.

## 핵심 기능

- AI·해커톤 테마의 촘촘한 4열 레트로 광고판 (태블릿 2열, 모바일 1열), 39개 PNG 배너 + 2개 다중 프레임 GIF.
- `assets/hackathon-hero.gif`, `assets/hackathon-card.gif`는 실제 애니메이션 파일. 수동 **움직임 끄기** 또는 OS의 `prefers-reduced-motion`에서는 각각 `*-still.png`로 교체. CSS 광택 효과도 정지.
- 모든 광고, 캐릭터 타일, CTA 및 헤더 설명 버튼은 **기존 설명창**만 열며 `Enter`/`Escape` 및 종료 시 포커스 복귀 지원.
- 기존 가상 카운트다운 로직은 경과시간 기준으로 유지하며, 실제 행사 마감 시간이 아님을 명확히 표시.
- **실제 이벤트 아님** 경고 유지, 개인정보 입력·로그인·결제·외부 API/추적·실제 AI 대결 미구현.
- 기존 Vercel 정적 배포 구성 `outputDirectory: public` 및 보안 헤더(CSP, `noindex`, `nosniff`, `Referrer-Policy`, `X-Frame-Options`) 유지.

## 기존 캐릭터 이미지 보존

**중요:** 원본 저장소의 `public/assets/character.png` 파일은 그대로 두었습니다. 이 오버레이에는 해당 원본 이미지가 **포함되지 않습니다**. 새 코드가 그 **기존 경로를 그대로 참조**하므로 ZIP을 *기존 리포지토리 루트 위에 병합*하면 기존 흰색 캐릭터가 그대로 표시됩니다. ZIP만 새 빈 폴더에 풀면 이 이미지 1개가 누락됩니다. 다른 이미지로 덮어쓰지 마세요.

## 기존 프로젝트에 적용

1. 원본 GitHub 저장소를 로컬에 복제하거나 기존 로컬 프로젝트 폴더에서 작업.
2. 기존 `public/assets/character.png`가 존재하는지 확인하고 백업.
3. ZIP의 `public/`, `tests/`, `vercel.json`, `package.json`, `README.md`를 저장소 루트에 병합.
4. 아래 검사 실행 후 변경사항 확인. **이 산출물은 GitHub에 커밋/푸시되지 않았습니다.**

```bash
npm run lint
npm test
python3 tests/assets_check.py
python3 tests/browser_check.py
npm run dev
```

`npm run lint`, `npm test`, `npm run dev`는 새 패키지 설치 없이 실행되며, Python 자산 검사·브라우저 검사에는 검사 환경에 Pillow, tinycss2, Playwright, Chromium이 있어야 합니다. 런타임 사용에는 필요하지 않습니다.

## 파일 역할

- `public/index.html`: 시맨틱 문서, Web Component별 템플릿, 모의 피싱 안내 및 메타 CSP
- `public/app.js`: 공용 ShadowComponent 기반 클래스, 14종 Web Components, 기존 타이머/모달, 이벤트 위임 및 움직임 관리
- `public/ads.js`: 39개의 순수 데이터 기반 배너 정의
- `public/styles.css`: 공용 Shadow DOM CSS 및 반응형·접근성 스타일
- `public/assets/tiles/*.png`: 자체 제작 39개 일반 광고 타일
- `public/assets/*.gif`: 실제 다중 프레임 GIF 2종
- `public/assets/*-still.png`: 저모션 정지 대체 프레임 2종
- `tests/site.test.js`: 컴포넌트 구조, 이벤트, CSP, Vercel, 기존 타이머/모달 퇴행 방지 계약 검사
- `tests/assets_check.py`: GIF 실제 프레임, PNG, CSS 구문 검사
- `tests/browser_check.py`: Chromium PC/모바일/저모션, 모달·키보드·포커스·움직임 테스트

## 수행한 검증

- Node.js 구문 검사: 통과
- `node --test tests/site.test.js`: **7/7 통과**
- GIF/PNG/CSS 자산 검사: 통과 (20프레임 이상, 39개 타일)
- Chromium PC 1280×900 / 모바일 390×844 / 저모션 390×844: 통과
- 광고 클릭/Enter, Escape/닫기, 포커스 복귀, CTA 설명창, 수동·OS 저모션 GIF→PNG, 실제 GIF 프레임 변화, 가로 넘침: 통과
- 로컬 HTTP 정적 파일 응답: HTML/JS/CSS/GIF/타일 200 OK

**브라우저 검증 한계:** 이 환경에서 Chromium의 `localhost` 및 가상 도메인 접속이 차단되어, 브라우저 테스트는 동일 소스코드를 인메모리로 주입해 실행하고 내부 이미지 URL만 데이터 URL로 치환합니다. 보안 정책과 HTTP 자산 응답은 별도 정적 검사/HTTP 확인으로 검증했습니다. 원본 `character.png`는 테스트용 투명 대체값을 사용했으며, 실제 병합 후 원본 이미지 렌더링/배포 통합 테스트는 필요합니다.
