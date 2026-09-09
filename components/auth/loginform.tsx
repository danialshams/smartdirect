"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { z } from "zod";

// Schema برای اعتبارسنجی فرم با Zod
const loginSchema = z.object({
    email: z.string().email({ message: "ایمیل نامعتبر است" }),
    password: z.string().min(6, { message: "رمز عبور باید حداقل ۶ کاراکتر باشد" }),
});

// استخراج Type از schema
type LoginInput = z.infer<typeof loginSchema>;

export default function LoginForm() {
    const router = useRouter();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError, // برای ست کردن خطاها از سمت سرور
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit: SubmitHandler<LoginInput> = async (data) => {
        const result = await signIn("credentials", { // "credentials" همان provider هست که در auth.ts تعریف کردی
            redirect: false, // جلوی ری‌دایرکت خودکار next-auth رو می‌گیریم
            email: data.email,
            password: data.password,
        });

        if (result?.error) {
            console.error("خطای لاگین:", result.error);
            // بر اساس خطای برگشتی از سرور، خطا رو توی فرم نشون بده
            setError("email", { type: "manual", message: "ایمیل یا رمز عبور اشتباه است" });
            setError("password", { type: "manual", message: "ایمیل یا رمز عبور اشتباه است" });
        } else {
            // لاگین موفق بود، ری‌دایرکت کن به صفحه داشبورد
            router.push("/dashboard"); // مسیر داشبورد رو اینجا بذار
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    ایمیل
                </label>
                <input
                    {...register("email")}
                    id="email"
                    type="email"
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
            </div>

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
