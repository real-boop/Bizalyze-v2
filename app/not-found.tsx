import Link from "next/link"
import { Button } from "@/components/ui/button"
import BackgroundPaths from "@/components/kokonutui/background-paths"

export default function NotFound() {
  return (
    <BackgroundPaths title="Not Found" subtle={true}>
      <div className="flex flex-col items-center justify-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500 dark:from-blue-400 dark:to-green-400">
          404 - Page Not Found
        </h2>
        <p className="text-lg mb-8 text-center max-w-md">
          The page you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/">
          <Button>Return to Home</Button>
        </Link>
      </div>
    </BackgroundPaths>
  )
}

