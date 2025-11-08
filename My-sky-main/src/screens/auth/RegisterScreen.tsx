import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../contexts/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { UserRegistration } from '../../models/User';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

const RegisterScreen: React.FC = () => {
  const [formData, setFormData] = useState<UserRegistration>({
    email: '',
    password: '',
    nickname: '',
    phoneNumber: '',
    gender: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { signUp } = useAuth();
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  
  const handleInputChange = (field: keyof UserRegistration, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const validateForm = (): boolean => {
    if (!formData.email || !formData.password || !formData.nickname) {
      setError('メールアドレス、パスワード、ニックネームは必須項目です');
      return false;
    }
    
    if (formData.password !== confirmPassword) {
      setError('パスワードと確認用パスワードが一致しません');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('パスワードは6文字以上である必要があります');
      return false;
    }
    
    const emailPattern = /^\S+@\S+\.\S+$/;
    if (!emailPattern.test(formData.email)) {
      setError('有効なメールアドレスを入力してください');
      return false;
    }
    
    return true;
  };
  
  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await signUp(formData);
      // 成功したら自動的にメイン画面に遷移する（AuthContextで処理）
    } catch (err: any) {
      console.error('Register error:', err);
      
      if (err.code === 'auth/email-already-in-use') {
        setError('このメールアドレスは既に使用されています');
      } else if (err.code === 'auth/invalid-email') {
        setError('無効なメールアドレス形式です');
      } else if (err.code === 'auth/weak-password') {
        setError('パスワードが弱すぎます。より強力なパスワードを使用してください');
      } else {
        setError('登録中にエラーが発生しました');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const navigateToLogin = () => {
    navigation.navigate('Login');
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>アカウント作成</Text>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>ニックネーム<Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={formData.nickname}
              onChangeText={(value) => handleInputChange('nickname', value)}
              placeholder="ニックネーム"
              autoCapitalize="none"
              returnKeyType="next"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>メールアドレス<Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              placeholder="example@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>パスワード<Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              placeholder="6文字以上のパスワード"
              secureTextEntry
              returnKeyType="next"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>パスワード（確認用）<Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="パスワードを再入力"
              secureTextEntry
              returnKeyType="next"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>電話番号</Text>
            <TextInput
              style={styles.input}
              value={formData.phoneNumber}
              onChangeText={(value) => handleInputChange('phoneNumber', value)}
              placeholder="電話番号（任意）"
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>性別</Text>
            <TextInput
              style={styles.input}
              value={formData.gender}
              onChangeText={(value) => handleInputChange('gender', value)}
              placeholder="性別（任意）"
              returnKeyType="done"
            />
          </View>
          
          <TouchableOpacity
            style={[styles.button, styles.registerButton]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>アカウント作成</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>すでにアカウントをお持ちですか？</Text>
            <TouchableOpacity onPress={navigateToLogin}>
              <Text style={styles.loginLink}>ログイン</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSize.xxl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
    marginTop: theme.spacing.xxl,
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: `${theme.colors.error}20`,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  required: {
    color: theme.colors.error,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.primary,
  },
  button: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: theme.spacing.md,
  },
  registerButton: {
    backgroundColor: theme.colors.primary,
    marginBottom: theme.spacing.lg,
  },
  buttonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  loginText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
    marginRight: theme.spacing.xs,
  },
  loginLink: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
});

export default RegisterScreen; 