import LoginForm from "../../components/auth/loginform";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">ورود به سامانه</h2>
                <LoginForm />
            </div>
        </div>
    );
}
