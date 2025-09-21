
const { from, of, throwError } = require('rxjs');
const { map, switchMap, catchError, finalize, tap } = require('rxjs/operators');

let _fetch = globalThis.fetch;
if (!_fetch) {
  try {
    _fetch = require('undici').fetch;
    globalThis.fetch = _fetch;
  } catch (e) {
    console.error('⚠️  No hay fetch disponible. Usa Node 18+ o instala "undici": npm i undici');
    process.exit(1);
  }
}

function httpGetJson(url) {
  return from(_fetch(url)).pipe(
    switchMap((res) => {
      if (!res.ok) {
        return throwError(() => new Error(`HTTP ${res.status} en ${url}`));
      }
      return from(res.json());
    })
  );
}

function getUsers() {
  const url = 'https://jsonplaceholder.typicode.com/users';
  return httpGetJson(url).pipe(
    map((users) =>
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }))
    )
  );
}


function getUserPosts(userId) {
  const url = `https://jsonplaceholder.typicode.com/users/${userId}/posts`;
  return httpGetJson(url);
}

function getPostComments(postId) {
  const url = `https://jsonplaceholder.typicode.com/posts/${postId}/comments`;
  return httpGetJson(url);
}


const flow$ = getUsers().pipe(
  tap((users) => {
    console.log(`👥 Usuarios recibidos: ${users.length}`);
  }),
  map((users) => users[0]), 
  tap((user) => {
    if (!user) {
      throw new Error('No hay usuarios disponibles.');
    }
    console.log(`➡️  Usuario seleccionado: [${user.id}] ${user.name} <${user.email}>`);
  }),

  switchMap((user) =>
    getUserPosts(user.id).pipe(
      map((posts) => ({
        user,
        posts: posts.map((p) => ({ id: p.id, title: p.title })),
      }))
    )
  ),

  tap(({ posts }) => {
    console.log(`📝 Publicaciones del usuario: ${posts.length}`);
  }),

  switchMap(({ user, posts }) => {
    const firstPost = posts[0];
    if (!firstPost) {
      return throwError(() => new Error('El usuario no tiene publicaciones.'));
    }
    console.log(`➡️  Primera publicación: [${firstPost.id}] ${firstPost.title}`);
    return getPostComments(firstPost.id).pipe(
      map((comments) => ({
        user,
        post: firstPost,
        comments: comments.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
        })),
      }))
    );
  }),


  catchError((err) => {
    console.error('❌ Error en la cadena:', err.message);
    return of(null);
  }),

  finalize(() => {
    console.log('✅ Flujo completado (finalize).');
  })
);

const subscription = flow$.subscribe((result) => {
  if (!result) return;

  const { user, post, comments } = result;
  console.log('\n===== RESULTADO FORMATEADO =====');
  console.log(`Usuario: [${user.id}] ${user.name} <${user.email}>`);
  console.log(`Publicación: [${post.id}] ${post.title}`);
  console.log(`Comentarios recibidos: ${comments.length}`);
  if (comments[0]) {
    console.log(`Primer comentario: [${comments[0].id}] ${comments[0].name} <${comments[0].email}>`);
  }
  console.log('================================\n');
});

