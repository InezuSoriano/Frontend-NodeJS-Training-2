// index.js
// ---------------------------------------------
// RxJS + fetch + JSONPlaceholder
// ---------------------------------------------

// --- Dependencias RxJS (CommonJS) ---
const { from, of, throwError } = require('rxjs');
const { map, switchMap, catchError, finalize, tap } = require('rxjs/operators');

// --- fetch en Node ---
// Node 18+ ya trae fetch global. Si no existe, intentamos usar 'undici' (opcional).
let _fetch = globalThis.fetch;
if (!_fetch) {
  try {
    _fetch = require('undici').fetch; // npm i undici
    globalThis.fetch = _fetch;
  } catch (e) {
    console.error('⚠️  No hay fetch disponible. Usa Node 18+ o instala "undici": npm i undici');
    process.exit(1);
  }
}

// ---------------------------------------------
// Helper HTTP: fetch -> Observable de JSON
// ---------------------------------------------
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

// ---------------------------------------------
// 3) Obtener todos los usuarios
//    - Devuelve Observable<[{ id, name, email }]> (datos relevantes)
// ---------------------------------------------
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

// ---------------------------------------------
// 4) Obtener publicaciones de un usuario
//    Requisito: https://jsonplaceholder.typicode.com/users/{userId}/posts
//    - Devuelve Observable<Post[]>
// ---------------------------------------------
function getUserPosts(userId) {
  const url = `https://jsonplaceholder.typicode.com/users/${userId}/posts`;
  return httpGetJson(url);
}

// ---------------------------------------------
// 5) Obtener comentarios de una publicación
//    Requisito: https://jsonplaceholder.typicode.com/posts/{postId}/comments
//    - Devuelve Observable<Comment[]>
// ---------------------------------------------
function getPostComments(postId) {
  const url = `https://jsonplaceholder.typicode.com/posts/${postId}/comments`;
  return httpGetJson(url);
}

// ---------------------------------------------
// 6) Encadenar: users -> posts(user1) -> comments(post1)
//    - switchMap para encadenar
//    - map para transformar
//    - tap para logs intermedios
// ---------------------------------------------
const flow$ = getUsers().pipe(
  tap((users) => {
    console.log(`👥 Usuarios recibidos: ${users.length}`);
  }),
  map((users) => users[0]), // seleccionamos el primer usuario
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

  // 7) Manejo de errores
  catchError((err) => {
    console.error('❌ Error en la cadena:', err.message);
    // Devolvemos un valor "nulo" para que el flujo no explote aguas arriba
    return of(null);
  }),

  // 8) Finalización
  finalize(() => {
    console.log('✅ Flujo completado (finalize).');
  })
);

// Ejecutar la cadena
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

// Nota: la suscripción se completa sola (no hay streams infinitos).
// Si añadieras intervals/websockets, recuerda desuscribir para evitar memory leaks.
