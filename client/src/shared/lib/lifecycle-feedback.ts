import { sileo } from "sileo"

type ToastKind = "info" | "success" | "warning" | "error"

function emit(kind: ToastKind, title: string, description: string) {
  sileo[kind]({ title, description })
}

export const lifecycleFeedback = {
  progress(title: string, description: string) {
    emit("info", title, description)
  },
  success(title: string, description: string) {
    emit("success", title, description)
  },
  warning(title: string, description: string) {
    emit("warning", title, description)
  },
  error(title: string, description: string) {
    emit("error", title, description)
  },
}
