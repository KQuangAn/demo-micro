'use client';
import { useRouter } from 'next/navigation';
import React from 'react';

export default async function RegisterButton() {
  const router = useRouter();
  const onClick = () => {
    router.push('/register');
  };
  return (
    <button type="button" onClick={onClick}>
      Register
    </button>
  );
}
