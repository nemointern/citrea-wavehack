import React from "react";
import {
  EyeOff,
  Eye,
  CheckCircle,
  Clock,
  TrendingUp,
  Target,
  X,
} from "lucide-react";

interface OrderStatusBadgeProps {
  status:
    | "COMMITTED"
    | "REVEALED"
    | "MATCHED"
    | "PARTIALLY_FILLED"
    | "FULLY_EXECUTED"
    | "CANCELLED";
  fillPercentage?: number;
  compact?: boolean;
  showIcon?: boolean;
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status,
  fillPercentage = 0,
  compact = false,
  showIcon = true,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case "COMMITTED":
        return {
          icon: EyeOff,
          label: compact ? "Committed" : "Committed",
          bgColor: "bg-yellow-500/20",
          textColor: "text-yellow-400",
          borderColor: "border-yellow-500/30",
          description: "Order committed to batch",
        };

      case "REVEALED":
        return {
          icon: Eye,
          label: compact ? "Revealed" : "Revealed",
          bgColor: "bg-blue-500/20",
          textColor: "text-blue-400",
          borderColor: "border-blue-500/30",
          description: "Order revealed, ready for matching",
        };

      case "MATCHED":
        return {
          icon: CheckCircle,
          label: compact ? "Matched" : "Matched",
          bgColor: "bg-green-500/20",
          textColor: "text-green-400",
          borderColor: "border-green-500/30",
          description: "Order successfully matched",
        };

      case "PARTIALLY_FILLED":
        return {
          icon: TrendingUp,
          label: compact
            ? `${fillPercentage.toFixed(0)}% Filled`
            : `Partially Filled (${fillPercentage.toFixed(1)}%)`,
          bgColor: "bg-orange-500/20",
          textColor: "text-orange-400",
          borderColor: "border-orange-500/30",
          description: `Order is ${fillPercentage.toFixed(1)}% executed`,
        };

      case "FULLY_EXECUTED":
        return {
          icon: Target,
          label: compact ? "Complete" : "Fully Executed",
          bgColor: "bg-emerald-500/20",
          textColor: "text-emerald-400",
          borderColor: "border-emerald-500/30",
          description: "Order fully executed (100%)",
        };

      case "CANCELLED":
        return {
          icon: X,
          label: compact ? "Cancelled" : "Cancelled",
          bgColor: "bg-red-500/20",
          textColor: "text-red-400",
          borderColor: "border-red-500/30",
          description: "Order has been cancelled",
        };

      default:
        return {
          icon: Clock,
          label: "Unknown",
          bgColor: "bg-gray-500/20",
          textColor: "text-gray-400",
          borderColor: "border-gray-500/30",
          description: "Unknown status",
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
        title={config.description}
      >
        {showIcon && <IconComponent className="w-3 h-3" />}
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      title={config.description}
    >
      {showIcon && <IconComponent className="w-4 h-4" />}
      <div className="flex flex-col">
        <span>{config.label}</span>
        {(status === "PARTIALLY_FILLED" || status === "FULLY_EXECUTED") &&
          fillPercentage > 0 && (
            <span className="text-xs opacity-75">
              {status === "PARTIALLY_FILLED" ? "In Progress" : "Complete"}
            </span>
          )}
      </div>
    </div>
  );
};

export default OrderStatusBadge;
