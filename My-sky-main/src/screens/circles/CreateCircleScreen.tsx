import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { getCurrentLocation } from '../../utils/locationUtils';
import { CircleCreation } from '../../models/Circle';

type CreateCircleNavigationProp = StackNavigationProp<DiscoverStackParamList, 'CreateCircle'>;

const DEFAULT_ICON = 'https://via.placeholder.com/150';
const DEFAULT_COVER = 'https://via.placeholder.com/800x200';

// カテゴリーリスト
const CATEGORIES = [
  { id: 'art', name: 'アート、クリエイティブ系' },
  { id: 'music', name: '音楽' },
  { id: 'sports', name: 'スポーツ、アウトドア' },
  { id: 'game', name: 'ゲーム、エンタメ系' },
  { id: 'food', name: '料理、グルメ' },
  { id: 'science', name: '科学、サイエンス' },
  { id: 'fashion', name: 'ファッション、美容' },
  { id: 'vehicle', name: '乗り物、コレクション' },
  { id: 'literature', name: '文学、言語' },
  { id: 'animal', name: 'ペット、動物' },
  { id: 'social', name: '社会、文化' },
  { id: 'business', name: '起業、イベント' },
];

// 都道府県リスト
const prefectures = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

interface ImageUpload {
  uri: string;
  fileName: string | undefined;
  type: string | undefined;
}

const CreateCircleScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<CreateCircleNavigationProp>();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [iconImage, setIconImage] = useState<ImageUpload | null>(null);
  const [coverImage, setCoverImage] = useState<ImageUpload | null>(null);
  const [activityArea, setActivityArea] = useState('');
  
  // 都道府県選択モーダル
  const [showPrefectureModal, setShowPrefectureModal] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // 初期位置情報を取得
  useEffect(() => {
    if (useCurrentLocation) {
      fetchCurrentLocation();
    }
  }, [useCurrentLocation]);
  
  const fetchCurrentLocation = async () => {
    try {
      const coords = await getCurrentLocation();
      setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('エラー', '現在地を取得できませんでした');
      setUseCurrentLocation(false);
    }
  };
  
  const handleSelectIcon = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 500,
        maxHeight: 500,
      });
      
      if (response.didCancel) return;
      
      if (response.errorCode) {
        throw new Error(response.errorMessage);
      }
      
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setIconImage({
          uri: asset.uri || '',
          fileName: asset.fileName,
          type: asset.type,
        });
      }
    } catch (error) {
      console.error('Error selecting icon image:', error);
      Alert.alert('エラー', '画像の選択に失敗しました');
    }
  };
  
  const handleSelectCover = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 600,
      });
      
      if (response.didCancel) return;
      
      if (response.errorCode) {
        throw new Error(response.errorMessage);
      }
      
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setCoverImage({
          uri: asset.uri || '',
          fileName: asset.fileName,
          type: asset.type,
        });
      }
    } catch (error) {
      console.error('Error selecting cover image:', error);
      Alert.alert('エラー', '画像の選択に失敗しました');
    }
  };
  
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };
  
  const uploadImage = async (image: ImageUpload, path: string): Promise<string> => {
    if (!image.uri) throw new Error('Invalid image URI');
    
    const fileName = image.fileName || `${Date.now()}.jpg`;
    const reference = storage().ref(`${path}/${fileName}`);
    
    // 画像をアップロード
    await reference.putFile(image.uri);
    
    // ダウンロードURLを取得
    const downloadURL = await reference.getDownloadURL();
    return downloadURL;
  };
  
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'サークル名を入力してください';
    }
    
    if (!description.trim()) {
      newErrors.description = '説明を入力してください';
    }
    
    if (selectedCategories.length === 0) {
      newErrors.categories = 'カテゴリーを1つ以上選択してください';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleCreateCircle = async () => {
    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // 画像のアップロード
      let iconUrl = DEFAULT_ICON;
      let coverUrl = DEFAULT_COVER;
      
      if (iconImage) {
        iconUrl = await uploadImage(iconImage, `circles/${Date.now()}`);
      }
      
      if (coverImage) {
        coverUrl = await uploadImage(coverImage, `circles/${Date.now()}`);
      }
      
      // サークルデータの作成
      const circleData: CircleCreation = {
        name,
        description,
        rules,
        categories: selectedCategories,
        isPrivate,
        createdBy: user.id,
        createdAt: firestore.FieldValue.serverTimestamp(),
        members: [user.id],
        admins: [user.id],
        icon: iconUrl,
        coverPhoto: coverUrl,
        activityArea,
      };
      
      // locationがある場合のみ追加
      if (useCurrentLocation && location) {
        circleData.location = {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address || '',
        };
      }
      
      // Firestoreにサークルを追加
      const circleRef = await firestore().collection('circles').add(circleData);
      const circleId = circleRef.id;
      console.log(`サークルを作成しました: ID=${circleId}`);
      
      // ユーザーのサークル参加情報を更新
      await firestore().collection('users').doc(user.id).update({
        circles: firestore.FieldValue.arrayUnion(circleId),
      });
      console.log(`ユーザー情報を更新しました: ユーザーID=${user.id}, サークルID=${circleId}`);
      
      Alert.alert('成功', 'サークルを作成しました', [
        { text: 'OK', onPress: () => {
          // Discoverスクリーンに戻り、強制的に再読み込みするためのユニークなタイムスタンプを付ける
          const timestamp = Date.now();
          console.log(`サークル作成完了: リフレッシュタイムスタンプ ${timestamp}, サークルID=${circleId}`);
          
          // サークル詳細画面に直接遷移
          navigation.navigate('CircleDetails', { circleId });
          
          /*
          // ホーム画面に戻る場合は以下を使用
          navigation.reset({
            index: 0,
            routes: [{ 
              name: 'Discover', 
              params: { 
                refresh: timestamp,
                newCircleId: circleId
              } 
            }],
          });
          */
        }},
      ]);
    } catch (error) {
      console.error('Error creating circle:', error);
      Alert.alert('エラー', 'サークルの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView style={styles.container}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>サークルを作成</Text>
          <View style={{ width: 40 }} />
        </View>
        
        {/* カバー画像 */}
        <TouchableOpacity style={styles.coverContainer} onPress={handleSelectCover}>
          <Image
            source={{ uri: coverImage?.uri || DEFAULT_COVER }}
            style={styles.coverImage}
          />
          <View style={styles.editCoverButton}>
            <Icon name="camera" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
        
        {/* アイコン画像 */}
        <View style={styles.iconContainer}>
          <TouchableOpacity onPress={handleSelectIcon}>
            <Image
              source={{ uri: iconImage?.uri || DEFAULT_ICON }}
              style={styles.iconImage}
            />
            <View style={styles.editIconButton}>
              <Icon name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.formContainer}>
          {/* サークル名 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>サークル名 <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              value={name}
              onChangeText={setName}
              placeholder="サークル名を入力"
              placeholderTextColor={theme.colors.text.secondary}
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>
          
          {/* 説明 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>説明 <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description ? styles.inputError : null]}
              value={description}
              onChangeText={setDescription}
              placeholder="サークルの説明を入力"
              placeholderTextColor={theme.colors.text.secondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
          </View>
          
          {/* 活動地域 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>活動地域</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowPrefectureModal(true)}
            >
              <Text style={activityArea ? styles.selectText : styles.placeholderText}>
                {activityArea || '選択してください'}
              </Text>
              <Icon name="chevron-down" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          {/* ルール */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ルール</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={rules}
              onChangeText={setRules}
              placeholder="サークルのルールを入力（任意）"
              placeholderTextColor={theme.colors.text.secondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          
          {/* カテゴリー */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>カテゴリー <Text style={styles.required}>*</Text></Text>
            <View style={styles.categoriesContainer}>
              {CATEGORIES.map(category => (
                <TouchableOpacity
                  key={`category-${category.id}`}
                  style={[
                    styles.categoryChip,
                    selectedCategories.includes(category.id) && styles.selectedCategoryChip,
                  ]}
                  onPress={() => toggleCategory(category.id)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategories.includes(category.id) && styles.selectedCategoryChipText,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.categories ? <Text style={styles.errorText}>{errors.categories}</Text> : null}
            {selectedCategories.length > 0 && (
              <Text style={styles.selectedCategoriesText}>
                選択中: {selectedCategories.map(id => CATEGORIES.find(c => c.id === id)?.name).join(', ')}
              </Text>
            )}
          </View>
          
          {/* プライバシー設定 */}
          <View style={styles.inputGroup}>
            <View style={[styles.switchContainer, styles.switchRow]}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchLabel}>非公開サークル</Text>
                <Text style={styles.switchDescription}>
                  オンにすると、招待されたユーザーのみがサークルに参加できます
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: '#767577', true: theme.colors.primary + '80' }}
                thumbColor={isPrivate ? theme.colors.primary : '#f4f3f4'}
              />
            </View>
          </View>
          
          {/* 位置情報 */}
          <View style={styles.inputGroup}>
            <View style={[styles.switchContainer, styles.switchRow]}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchLabel}>現在地を使用</Text>
                <Text style={styles.switchDescription}>
                  オンにすると、現在地がサークルの位置情報として設定されます
                </Text>
              </View>
              <Switch
                value={useCurrentLocation}
                onValueChange={setUseCurrentLocation}
                trackColor={{ false: '#767577', true: theme.colors.primary + '80' }}
                thumbColor={useCurrentLocation ? theme.colors.primary : '#f4f3f4'}
              />
            </View>
          </View>
          
          {/* 作成ボタン */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.disabledButton]}
            onPress={handleCreateCircle}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>サークルを作成</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* 都道府県選択モーダル */}
      <Modal
        visible={showPrefectureModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPrefectureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>活動地域を選択</Text>
              <TouchableOpacity onPress={() => setShowPrefectureModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={prefectures}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    activityArea === item && styles.selectedOptionItem,
                  ]}
                  onPress={() => {
                    setActivityArea(item);
                    setShowPrefectureModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      activityArea === item && styles.selectedOptionText,
                    ]}
                  >
                    {item}
                  </Text>
                  {activityArea === item && (
                    <Icon name="checkmark" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  coverContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editCoverButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.background,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: -50,
  },
  iconImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editIconButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: 15,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: theme.colors.text.primary,
    marginBottom: 5,
  },
  required: {
    color: theme.colors.error,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginTop: 5,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    paddingHorizontal: 15,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  placeholderText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryChip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedCategoryChip: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  selectedCategoryChipText: {
    color: theme.colors.primary,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchTextContainer: {
    flexDirection: 'column',
    flex: 1,
    paddingRight: 10,
  },
  switchLabel: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  switchDescription: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 5,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectedOptionItem: {
    backgroundColor: theme.colors.primary + '10',
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  selectedOptionText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  selectedCategoriesText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 5,
  },
});

export default CreateCircleScreen;