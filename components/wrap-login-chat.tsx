"use client";

import { useEffect, useState } from "react";
import Chat from "@/components/chat";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SIGN_UP_URL } from "@/lib/constants";
import { useMCP } from "@/lib/context/mcp-context";

export default function WrapLoginChat() {
  const { setUserStatus, userStatus } = useMCP();
  
  // Login logic
  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState(
    (typeof window !== "undefined" && localStorage.getItem("username")) || ""
  );
  const [password, setPassword] = useState(
    (typeof window !== "undefined" && localStorage.getItem("password")) || ""
  );
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.message || "登录失败");
        return;
      }
      setUserStatus({ username, pubwikiCookie: data.cookies });
      localStorage.setItem("username", username);
      localStorage.setItem("password", password);
      setLoginOpen(false);
    } catch (err) {
      setLoginError("请求出错，请稍后再试");
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    console.log("userStatus changed:", userStatus);
    if (!userStatus) {
      setLoginOpen(true);
    }
  }, []);

  if (loginOpen) {
    return (
      <Dialog
        open={loginOpen}
        onOpenChange={(open) => {
          setLoginOpen(open);
          if (!open) {
            setUsername("");
            setPassword("");
            setLoginError("");
          }
        }}
      >
        <DialogContent
          className="sm:max-w-[400px]"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Login</DialogTitle>
            <DialogDescription>
              Please enter your credentials to access your account.{" "}
              <a className="text-blue-500 hover:underline" href={SIGN_UP_URL}>
                SIGN UP a new account
              </a>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {loginError && (
              <p className="text-sm text-red-500 font-medium">{loginError}</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? "Logging in..." : "Login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return <Chat />;
}