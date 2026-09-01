// Design system — reusable UI primitives.
// Import from '@/components/ui' instead of reaching into individual files.

// Foundations
export { Button, buttonVariants } from './button'
export { Badge, badgeVariants } from './badge'
export { Card, cardVariants } from './card'
export { Container, Section } from './container'
export { IconBadge, iconBadgeVariants } from './icon-badge'
export { SectionHeading } from './section-heading'
export { StatCard } from './stat-card'

// Forms
export { Input, type InputProps } from './input'
export { Textarea, type TextareaProps } from './textarea'
export { SearchField, type SearchFieldProps } from './search-field'

// Feedback & status
export { Skeleton } from './skeleton'
export { Loading } from './loading'
export { EmptyState } from './empty-state'
export { ToastProvider, useToast } from './toast'
export { Tooltip } from './tooltip'

// Overlays
export { Modal } from './modal'
export { Dialog } from './dialog'
export { Drawer } from './drawer'

// Data display
export { Avatar } from './avatar'
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './table'
export { Pagination } from './pagination'
export { Breadcrumb, type BreadcrumbItem } from './breadcrumb'
export { Gallery, type GalleryImage } from './gallery'

// Disclosure & navigation
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion'
export { Carousel } from './carousel'
