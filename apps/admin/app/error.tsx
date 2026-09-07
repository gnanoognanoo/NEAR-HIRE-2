"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>Something needs attention.</h1>
      <p>We couldn't finish loading this page. Please try again.</p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
