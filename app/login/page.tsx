import LoginForm from "../../components/auth/loginform";

type LoginPageProps = {
    searchParams: Promise<{ callbackUrl?: string | string[] | undefined }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = await searchParams;
    const callbackUrl = Array.isArray(params.callbackUrl) ? params.callbackUrl[0] : params.callbackUrl;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">ورود به سامانه</h2>
                <LoginForm callbackUrl={callbackUrl} />
            </div>
        </div>
    );
}