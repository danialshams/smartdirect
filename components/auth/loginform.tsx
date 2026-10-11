"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useForm, SubmitHandler } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
    email: z.string().email({ message: "ایمیل نامعتبر است" }),
    password: z.string().min(6, { message: "رمز عبور باید حداقل ۶ کاراکتر باشد" }),
});

type LoginInput = z.infer<typeof loginSchema>;

function getSafeCallbackUrl(value: string | null) {
    if (!value) return "/dashboard";

    try {
        const decoded = decodeURIComponent(value);
        if (decoded.startsWith("/") && !decoded.startsWith("//")) {
            return decoded;
        }
    } catch {
        // Use the default destination for malformed values.
    }

    return "/dashboard";
}

function getLoginError(error?: string | null) {
    if (error === "CredentialsSignin") return "ایمیل یا رمز عبور اشتباه است";
    if (error === "Configuration") return "ورود موقتاً در دسترس نیست. لطفاً بعداً تلاش کنید.";
    if (error) return "ورود انجام نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.";
    return null;
}

export default function LoginForm({
    callbackUrl,
    error,
}: {
    callbackUrl?: string | null;
    error?: string | null;
}) {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError,
        clearErrors,
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit: SubmitHandler<LoginInput> = async (data) => {
        clearErrors("root.server");

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: data.email,
                password: data.password,
            });

            if (!result || !result.ok || result.error) {
                setError("root.server", {
                    type: "server",
                    message: result?.error === "CredentialsSignin"
                        ? "ایمیل یا رمز عبور اشتباه است"
                        : "ورود انجام نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.",
                });
                return;
            }

            window.location.assign(getSafeCallbackUrl(callbackUrl ?? null));
        } catch {
            setError("root.server", {
                type: "server",
                message: "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.",
            });
        }
    };

    const visibleError = errors.root?.server?.message ?? getLoginError(error);

    return (
        <form
            method="post"
            action="/api/auth/legacy-login"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
        >
            <input
                type="hidden"
                name="callbackUrl"
                value={getSafeCallbackUrl(callbackUrl ?? null)}
            />
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    ایمیل
                </label>
                <input
                    {...register("email")}
                    id="email"
                    type="email"
                    autoComplete="username"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    رمز عبور
                </label>
                <input
                    {...register("password")}
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
            </div>

            {visibleError && (
                <p role="alert" aria-live="polite" className="text-red-600 text-sm">
                    {visibleError}
                </p>
            )}

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
                {isSubmitting ? "در حال ورود..." : "ورود"}
            </button>
        </form>
    );
}
