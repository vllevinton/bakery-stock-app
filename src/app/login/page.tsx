import LoginForm from "./ui/LoginForm";

export default function LoginPage() {
  
  return (
    <div className="min-h-screen bg-login">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
        <div className="card w-full max-w-lg p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-2 flex items-center justify-center gap-2 text-3xl font-extrabold text-brand-800">
              <span className="text-3xl">🍞</span> Bakery
            </div>
            <div className="text-slate-600">Sistema de Gestión de Stock</div>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
