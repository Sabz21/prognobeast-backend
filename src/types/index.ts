// src/types/index.ts

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data?: T;
}
