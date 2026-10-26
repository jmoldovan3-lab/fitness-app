export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section class="screen">
      <header class="top"><h1>{title}</h1></header>
      <article class="card"><p class="muted">{text}</p></article>
    </section>
  );
}
