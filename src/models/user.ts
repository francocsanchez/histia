import { Model, Schema, model, models } from "mongoose";

export interface UserDocument {
  _id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
  apellido?: string | null;
  activo?: boolean | null;
  roles?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    role: { type: String, default: "user" },
    apellido: { type: String, default: "" },
    activo: { type: Boolean, default: true, index: true },
    roles: { type: String, default: "" },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    banExpires: { type: Date, default: null },
  },
  {
    collection: "users",
    timestamps: true,
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ roles: 1 });

export const UserModel =
  (models.User as Model<UserDocument>) || model<UserDocument>("User", userSchema);
