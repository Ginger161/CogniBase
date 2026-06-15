import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 w-full max-w-4xl mx-auto text-center" style={{ backgroundColor: "#000000" }}>
      
      {/* Official Logo */}
      <img 
        src="/logo.png" 
        alt="CogniBase Logo" 
        style={{ width: "12rem", height: "auto", margin: "0 auto 3rem auto", display: "block", objectFit: "contain" }} 
      />

      <h1 style={{ fontSize: "clamp(2.1rem, 7vw, 4.5rem)", fontWeight: "bold", letterSpacing: "-0.05em", lineHeight: "1.1", marginBottom: "2rem" }}>
        <span style={{ color: "white" }}>Every lecture,</span>
        <br />
        <span style={{
          background: "linear-gradient(to right, #EA580C, #F59E0B, #EAB308)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          color: "transparent"
        }}>
          perfectly synthesized.
        </span>
      </h1>
      
      <p style={{ color: "#A1A1AA", fontSize: "1.15rem", maxWidth: "36rem", margin: "0 auto 3rem auto", lineHeight: "1.6" }}>
        CogniBase transforms scattered notes and coursework into a high-performance, intelligent study terminal.
      </p>
      
      <Link href="/login" style={{ textDecoration: "none" }}>
        <button style={{
          backgroundColor: "#EA580C",
          color: "white",
          padding: "1rem 2.5rem",
          borderRadius: "0.75rem",
          fontWeight: "bold",
          fontSize: "1.125rem",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 0 40px rgba(234,88,12,0.4)",
          transition: "transform 0.2s"
        }}>
          Get Started
        </button>
      </Link>

    </main>
  );
}
