export function Header() {
  return (
    <div className="flex flex-col items-center justify-center py-3 sm:py-4 bg-background px-4">
      <img src="/logo.png" alt="Jalsa Salana Logo" className="w-16 h-16 sm:w-20 sm:h-20 mb-2 rounded-full shadow-lg" />
      <h1 className="text-lg sm:text-2xl font-bold text-primary text-center px-2">Jalsa Salana Management System</h1>
      <div className="w-12 sm:w-16 h-1 bg-primary mt-2 rounded-full"></div>
    </div>
  )
}

export default Header
