# 워치 미니게임

갤럭시 워치의 웹 브라우저에서 가볍게 즐기는 터치 미니게임 프로젝트.
HTML, CSS, JavaScript만 사용하며 서버, 패키지 설치, 빌드가 필요 없습니다.

- 게임: https://minantonio46.github.io/watch-minigames/
- 저장소: https://github.com/minantonio46/watch-minigames
- 배포 설정: `main` 브랜치의 `/(root)` (GitHub Pages)
- 로컬 `origin`과 `main`의 upstream 연결 완료. TortoiseGit에서 Commit → Push로 업데이트합니다.

## 실행

로컬에서는 `index.html`을 브라우저로 열면 됩니다.
첫 게임은 초록색으로 바뀐 버튼을 누르는 반응속도 게임입니다.
최고 기록은 해당 브라우저에 저장됩니다. 저장이 차단되어도 게임은 실행됩니다.
화면이 꺼지거나 다른 탭으로 전환되면 진행 중인 판을 취소합니다.
실제 워치의 브라우저, 화면 배율, 절전 동작에 따른 확인은 필요합니다.

## TortoiseGit과 GitHub

이 폴더 자체가 Git 저장소 루트입니다. TortoiseGit은 같은 `.git` 저장소를 사용하는 Windows GUI입니다.

1. GitHub에서 빈 `watch-minigames` 저장소를 만듭니다. 무료 계정에서 Pages를 사용하려면 공개 저장소로 시작하면 됩니다.
2. 폴더 우클릭 → TortoiseGit → Settings → Git → Remote에서 `origin`을 추가하고 GitHub 저장소 URL을 넣습니다.
3. 변경한 파일을 Git Commit → `main`으로 커밋한 뒤 Push합니다.
4. GitHub 저장소의 Settings → Pages → Build and deployment에서 **Deploy from a branch**, **main**, **/(root)**를 선택하고 저장합니다.
5. 배포 완료 후 `https://계정명.github.io/watch-minigames/`를 워치 브라우저에서 엽니다. 정확한 주소는 Pages 화면에 표시됩니다.

이후 수정 → Commit → Push하면 Pages에 반영됩니다. 첫 배포와 업데이트에는 시간이 걸릴 수 있습니다.
저장소 이름이 다르면 URL의 마지막 경로도 바뀝니다. 외부 서비스 키나 비밀정보를 파일에 넣지 마세요.

공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## 개발 기준

- 작은 원형 화면의 중앙에 핵심 정보와 버튼 배치
- 큰 터치 영역, 드래그나 키보드 없이 조작
- 외부 폰트·라이브러리 없이 적은 요청과 작은 파일 유지
- 상대 경로 사용으로 GitHub Pages 저장소 하위 경로 지원
- 짧은 플레이 시간, 백그라운드에서 게임 중단

## 확인 항목

- 시작 → 대기 → 초록 버튼 터치 → 기록 표시
- 대기 중 터치 시 실패 처리 및 재시작
- 탭을 숨겼다가 돌아오면 재시작 가능
- 새로고침 후 최고 기록 유지 (저장 가능한 브라우저)
- 실제 워치에서 글자와 버튼이 원형 화면 밖으로 잘리지 않는지 확인
