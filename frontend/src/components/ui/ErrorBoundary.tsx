import React, { Component, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log lỗi — trong production có thể gửi lên Sentry/Crashlytics
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View className="flex-1 items-center justify-center bg-gray-50 px-8">
          <Text className="text-5xl mb-4">⚠️</Text>
          <Text className="text-lg font-bold text-gray-900 text-center mb-2">
            Đã xảy ra lỗi
          </Text>
          <Text className="text-sm text-gray-500 text-center mb-6">
            Ứng dụng gặp sự cố không mong đợi. Vui lòng thử lại.
          </Text>
          <TouchableOpacity
            onPress={this.handleReset}
            className="bg-primary-500 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
