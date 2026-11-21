# B-127 포트폴리오

이 폴더는 새 사이트의 소스입니다. 기존 사이트 파일은 옆의 `b127` 폴더에 있습니다. 새 사이트에도 기존 작품 31개의 주소를 사용할 수 있습니다.

## 관리 화면 쓰기

1. 배포된 사이트 주소 끝에 `/admin/`을 붙여 들어가고 GitHub 계정으로 로그인합니다. 해당 비공개 저장소에 쓰기 권한이 있는 계정만 게시할 수 있습니다.
2. 연도가 목록에 없다면 **연도 → 새 연도**에서 네 자리 숫자를 입력하고 게시합니다.
3. **작품 → 새 작품**에서 제목과 연도를 고릅니다. 대표 사진을 올리고, 필요한 경우 상세 사진, 재료, 크기와 설명을 추가합니다.
4. **게시**를 누르면 호스팅에서 사이트를 다시 만들고 작품 목록에 반영합니다. 수정은 **작품**에서 기존 항목을 열어 같은 방식으로 게시합니다.

대표 사진은 목록에 표시됩니다. 상세 사진을 따로 넣지 않은 새 작품은 상세 화면에도 대표 사진을 사용합니다. 사진 파일은 업로드한 상태로 보존되며, 사이트에서 **원본 사진 보기**를 눌러 열 수 있습니다.

## 미리보기

Node.js 22와 Python 3.12 환경의 터미널에서 아래 명령을 실행합니다.

```sh
python3 -m pip install -r requirements.txt
node build.mjs
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

브라우저에서 `http://localhost:8000/`을 엽니다. 로컬 관리 화면까지 시험하려면 같은 폴더의 별도 터미널에서 `npx decap-server`를 실행하고 `http://localhost:8000/admin/`을 엽니다. 로컬에서 시험 게시한 내용은 이 폴더에 저장됩니다. 방문자 화면에 적용하려면 `node build.mjs`를 다시 실행합니다. [Decap 로컬 미리보기 안내](https://decapcms.org/docs/decap-proxy/)

## 기존 주소를 유지하는 배포

1. 이 폴더의 소스를 비공개 GitHub 저장소에 올립니다. `dist/`는 호스팅에서 생성합니다.
2. Netlify에서 새 프로젝트를 만들 필요 없이, 기존 **b-127** 프로젝트의 **Project configuration → Developer settings → Continuous deployment → Repository → Link repository**에서 이 저장소를 연결합니다. [Netlify 저장소 연결](https://docs.netlify.com/build/git-workflows/repo-permissions-linking/)
3. GitHub에 OAuth 앱을 등록합니다. 홈페이지 URL은 `https://b-127.netlify.app/`, 콜백 URL은 `https://api.netlify.com/auth/done`입니다. Netlify **Project configuration → Access & security → OAuth**에서 GitHub 제공자를 설치하고 앱의 ID와 Secret을 입력합니다. [Decap GitHub 로그인](https://decapcms.org/docs/github-backend/) · [Netlify OAuth 연결](https://docs.netlify.com/manage/security/secure-access-to-sites/oauth-provider-tokens/)
4. 배포 완료 후 `https://b-127.netlify.app/admin/`에서 허용된 GitHub 계정으로 로그인하고, 연도와 작품 게시 후 방문자 페이지에 반영되는지 확인합니다. 빌드 명령과 공개 폴더는 이 폴더의 `netlify.toml`에 설정되어 있습니다.

## GitHub Pages로 배포

1. 배포에 사용할 GitHub 계정에서 `b-127`이라는 공개 저장소를 만들고 이 폴더의 소스를 `main` 브랜치에 올립니다. 코드와 작품 사진 원본이 함께 공개됩니다.
2. 저장소 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다. **Actions → Publish B-127 to GitHub Pages → Run workflow**를 처음 한 번 실행하면 `https://<계정>.github.io/b-127/`이 만들어집니다. 이후에는 `main`에 게시할 때 자동으로 배포합니다. [GitHub Pages 배포 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
3. 관리자 로그인을 사용하려면 같은 GitHub 계정에서 OAuth 앱을 만들고, Decap 공식 문서에서 안내하는 Cloudflare Worker에 연결합니다. 콜백 주소는 Worker 주소 뒤에 `/callback`을 붙인 URL입니다. OAuth 앱의 Client Secret은 Worker의 Secret으로 설정합니다. [Decap 설정](https://decapcms.org/docs/backends-overview/#using-github-with-an-oauth-proxy) · [OAuth Worker 설정](https://github.com/sterlingwes/decap-proxy#setup)
4. GitHub 저장소 **Settings → Secrets and variables → Actions → Variables**에 환경 변수 `B127_CMS_AUTH_URL`을 추가합니다. 값은 `/callback`을 제외한 Worker 주소입니다. 배포 워크플로를 다시 실행하면 사이트 주소 뒤에 `/admin/`을 붙여 로그인할 수 있습니다. 작품을 게시할 계정에만 저장소 쓰기 권한을 부여합니다.

## 새 주소를 쓰는 배포

Cloudflare Pages에서 같은 비공개 GitHub 저장소를 연결합니다. 빌드 명령은 `python3 -m pip install -r requirements.txt && node build.mjs`, 결과 폴더는 `dist`입니다. Pages의 정적 파일에는 파일 하나당 25 MiB 제한이 있습니다. [Cloudflare Git 배포](https://developers.cloudflare.com/pages/get-started/git-integration/) · [파일 제한](https://developers.cloudflare.com/pages/platform/limits/)

공개 사이트와 별도로 Decap의 GitHub 로그인용 OAuth 서비스를 설정합니다. Cloudflare Pages 프로덕션 환경에 `B127_CMS_REPO`(GitHub 소유자/저장소 이름), `B127_CMS_AUTH_URL`(HTTPS 로그인 서비스 주소)를 지정합니다. 게시 브랜치가 `main` 이외라면 `B127_CMS_BRANCH`도 설정합니다. 이 값이 연결되면 프로덕션 빌드에서 `/admin/`이 생성됩니다. [Decap 외부 OAuth 안내](https://decapcms.org/docs/external-oauth-clients/)

## 데이터와 사진

- 등록한 연도와 작품 정보는 GitHub의 `content/`에 저장됩니다. 데이터베이스를 따로 운영하지 않습니다.
- 업로드한 원본은 `img/uploads/`에 저장됩니다. 이미지 미리보기는 빌드할 때 `dist/media/`에 WebP로 만듭니다.
- 관리자 화면의 항목과 라벨은 `admin/collections.yml`에서 관리합니다. 공개 페이지의 공통 영역은 `templates/layout.html`에 있습니다.
